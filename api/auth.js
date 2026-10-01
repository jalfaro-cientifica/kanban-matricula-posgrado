// api/auth.js - Authentication & Registration endpoint connected to MongoDB Atlas
const crypto = require('crypto');
const { connectToDatabase } = require('../lib/mongodb');

// In-memory fallback buffer for users
const inMemoryUsers = [];

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
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    console.warn('[AUTH API]: MongoDB Atlas no accesible desde esta IP, usando fallback en memoria.');
  }

  // GET /api/auth -> List public user profiles (for assignees dropdown)
  if (req.method === 'GET') {
    if (db) {
      try {
        const collection = db.collection('users');
        const users = await collection
          .find({}, { projection: { passwordHash: 0, _id: 0 } })
          .sort({ createdAt: -1 })
          .toArray();
        return res.status(200).json(users);
      } catch (e) {
        console.warn('[AUTH GET DB ERROR]:', e.message);
      }
    }
    const publicMemory = inMemoryUsers.map(u => {
      const copy = { ...u };
      delete copy.passwordHash;
      return copy;
    });
    return res.status(200).json(publicMemory);
  }

  // POST /api/auth
  if (req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.action) {
      return res.status(400).json({ error: 'Acción no especificada (register o login)' });
    }

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
      if (db) {
        try {
          const collection = db.collection('users');
          const existing = await collection.findOne({ email: cleanEmail });
          if (existing) {
            return res.status(409).json({ error: 'El correo electrónico ya está registrado. Por favor inicia sesión.' });
          }
        } catch (e) {
          console.warn('[AUTH CHECK USER ERROR]:', e.message);
        }
      } else {
        const memExisting = inMemoryUsers.find(u => u.email === cleanEmail);
        if (memExisting) {
          return res.status(409).json({ error: 'El correo electrónico ya está registrado. Por favor inicia sesión.' });
        }
      }

      const cleanName = name.trim();
      const parts = cleanName.split(/\s+/);
      const shortName = parts[0];
      const userRole = role && role.trim() ? role.trim() : 'Colaborador UCS';
      const color = getRoleColor(userRole);
      const avatarInitials = getAvatarInitials(cleanName);

      const newUser = {
        id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: cleanName,
        shortName: shortName,
        email: cleanEmail,
        role: userRole,
        passwordHash: hashPassword(password),
        avatarInitials: avatarInitials,
        color: color,
        createdAt: new Date().toISOString()
      };

      if (db) {
        try {
          const collection = db.collection('users');
          await collection.insertOne(newUser);
          delete newUser._id;
        } catch (e) {
          console.warn('[AUTH INSERT DB ERROR]:', e.message);
          inMemoryUsers.push(newUser);
        }
      } else {
        inMemoryUsers.push(newUser);
      }

      const safeUser = { ...newUser };
      delete safeUser.passwordHash;

      return res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        user: safeUser
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
      let foundUser = null;

      if (db) {
        try {
          const collection = db.collection('users');
          foundUser = await collection.findOne({ email: cleanEmail });
        } catch (e) {
          console.warn('[AUTH FIND DB ERROR]:', e.message);
        }
      }

      if (!foundUser) {
        foundUser = inMemoryUsers.find(u => u.email === cleanEmail);
      }

      if (!foundUser) {
        return res.status(401).json({
          error: 'No existe una cuenta con este correo electrónico. Por favor regístrate primero.'
        });
      }

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
        message: 'Inicio de sesión exitoso',
        user: safeUser
      });
    }

    return res.status(400).json({ error: 'Acción inválida' });
  }

  return res.status(405).json({ error: 'Método no permitido' });
};
