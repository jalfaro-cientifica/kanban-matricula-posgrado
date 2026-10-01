// api/auth.js - Authentication & Registration endpoint connected directly to MongoDB Atlas
const crypto = require('crypto');
const { connectToDatabase } = require('../lib/mongodb');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_ucs_salt_2026').digest('hex');
}

function getAvatarInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getRoleColor(role) {
  const r = (role || '').toLowerCase();
  if (r.includes('arquitecto') || r.includes('líder') || r.includes('lider')) return '#059669';
  if (r.includes('full stack')) return '#0284c7';
  if (r.includes('qa')) return '#f59e0b';
  if (r.includes('frontend')) return '#7c3aed';
  if (r.includes('backend')) return '#06b6d4';
  return '#3b82f6';
}

async function parseBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        return null;
      }
    }
    return req.body;
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', () => {
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        resolve(null);
      }
    });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let db = null;
  let dbError = null;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    dbError = err.message;
    console.error('[AUTH API]: Error conectando a MongoDB Atlas:', err.message);
  }

  res.setHeader('X-Db-Status', db ? 'connected' : 'atlas-unreachable');
  if (dbError) {
    res.setHeader('X-Db-Error', encodeURIComponent(dbError));
  }

  // GET /api/auth -> List public registered users from Atlas
  if (req.method === 'GET') {
    if (!db) {
      return res.status(503).json({
        error: 'No se pudo conectar con MongoDB Atlas.',
        details: dbError,
        hint: 'Verifica que en MongoDB Atlas -> Network Access esté permitida la IP 0.0.0.0/0 para conexiones desde Vercel.'
      });
    }

    try {
      const collection = db.collection('users');
      const users = await collection
        .find({}, { projection: { passwordHash: 0, _id: 0 } })
        .sort({ createdAt: -1 })
        .toArray();
      return res.status(200).json(users);
    } catch (e) {
      return res.status(500).json({ error: 'Error al consultar usuarios en MongoDB Atlas', details: e.message });
    }
  }

  // POST /api/auth
  if (req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.action) {
      return res.status(400).json({ error: 'Acción no especificada (register o login).' });
    }

    // Require database connection for all auth operations
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'No se puede conectar a MongoDB Atlas. MongoDB rechazó la conexión desde los servidores de Vercel (Alerta TLS / IP no autorizada). Para resolverlo: ingresa a MongoDB Atlas > Network Access y agrega la regla 0.0.0.0/0 (Allow Access from Anywhere).',
        details: dbError,
        code: 'ATLAS_WHITELIST_REQUIRED'
      });
    }

    const collection = db.collection('users');
    const action = body.action;

    // REGISTER ACTION
    if (action === 'register') {
      const { name, email, role, password } = body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Por favor completa todos los campos obligatorios.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return res.status(400).json({ error: 'Formato de correo electrónico inválido.' });
      }

      if (password.length < 4) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });
      }

      // Check if user already exists
      const existing = await collection.findOne({ email: cleanEmail });
      const cleanName = name.trim();
      const parts = cleanName.split(/\s+/);
      const shortName = parts[0];
      const userRole = role && role.trim() ? role.trim() : 'Colaborador UCS';
      const color = getRoleColor(userRole);
      const avatarInitials = getAvatarInitials(cleanName);
      const hashedPass = hashPassword(password);

      if (existing) {
        // Update credentials and role if already registered
        await collection.updateOne(
          { email: cleanEmail },
          {
            $set: {
              name: cleanName,
              shortName: shortName,
              role: userRole,
              passwordHash: hashedPass,
              avatarInitials: avatarInitials,
              color: color,
              updatedAt: new Date().toISOString()
            }
          }
        );

        const updatedDoc = await collection.findOne({ email: cleanEmail }, { projection: { passwordHash: 0, _id: 0 } });
        return res.status(200).json({
          success: true,
          message: 'Cuenta actualizada exitosamente en MongoDB Atlas.',
          user: updatedDoc,
          savedInAtlas: true
        });
      }

      const newUser = {
        id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: cleanName,
        shortName: shortName,
        email: cleanEmail,
        role: userRole,
        passwordHash: hashedPass,
        avatarInitials: avatarInitials,
        color: color,
        createdAt: new Date().toISOString()
      };

      await collection.insertOne(newUser);

      const safeUser = { ...newUser };
      delete safeUser._id;
      delete safeUser.passwordHash;

      return res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente en MongoDB Atlas.',
        user: safeUser,
        savedInAtlas: true
      });
    }

    // LOGIN ACTION
    if (action === 'login') {
      const { email, password } = body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Por favor ingresa tu correo y contraseña.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const incomingHash = hashPassword(password);

      const foundUser = await collection.findOne({ email: cleanEmail });

      if (!foundUser) {
        return res.status(401).json({
          error: 'No existe una cuenta registrada con este correo electrónico (' + cleanEmail + '). Por favor regístrate primero en la pestaña "Registrarse".'
        });
      }

      // STRICT PASSWORD VERIFICATION
      if (foundUser.passwordHash !== incomingHash) {
        return res.status(401).json({
          error: 'Contraseña incorrecta. Por favor verifica tus credenciales.'
        });
      }

      const safeUser = { ...foundUser };
      delete safeUser._id;
      delete safeUser.passwordHash;

      return res.status(200).json({
        success: true,
        message: 'Inicio de sesión exitoso.',
        user: safeUser,
        verifiedInAtlas: true
      });
    }

    return res.status(400).json({ error: 'Acción inválida.' });
  }

  return res.status(405).json({ error: 'Método no permitido.' });
};
