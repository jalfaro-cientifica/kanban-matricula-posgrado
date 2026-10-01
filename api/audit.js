// api/audit.js - Audit Trail endpoint connected to MongoDB Atlas with resilient in-memory fallback
const { connectToDatabase } = require('../lib/mongodb');

// In-memory fallback if Atlas is temporarily unreachable or awaiting 0.0.0.0/0 whitelist
const inMemoryAuditLogs = [];

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
    console.warn('[AUDIT API]: MongoDB Atlas no accesible desde esta IP, usando buffer en memoria.');
  }

  // GET /api/audit
  if (req.method === 'GET') {
    if (db) {
      try {
        const collection = db.collection('audit_logs');
        const limit = parseInt(req.query && req.query.limit ? req.query.limit : '100', 10);
        const logs = await collection
          .find({}, { projection: { _id: 0 } })
          .sort({ timestamp: -1 })
          .limit(limit)
          .toArray();
        return res.status(200).json(logs);
      } catch (e) {
        console.warn('[AUDIT GET DB ERROR]:', e.message);
      }
    }
    return res.status(200).json(inMemoryAuditLogs);
  }

  // POST /api/audit
  if (req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.action) {
      return res.status(400).json({ error: 'Datos de auditoría incompletos' });
    }

    const logEntry = {
      id: 'AUD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: body.timestamp || new Date().toISOString(),
      userName: body.userName || 'Usuario Anónimo',
      userEmail: body.userEmail || 'desconocido@cientifica.edu.pe',
      userRole: body.userRole || 'Colaborador',
      action: body.action,
      taskId: body.taskId || null,
      taskCode: body.taskCode || null,
      taskTitle: body.taskTitle || null,
      details: body.details || '',
      fromCol: body.fromCol || null,
      toCol: body.toCol || null
    };

    if (db) {
      try {
        const collection = db.collection('audit_logs');
        await collection.insertOne(logEntry);
        delete logEntry._id;
        return res.status(201).json({ success: true, source: 'mongodb', log: logEntry });
      } catch (e) {
        console.warn('[AUDIT POST DB ERROR]:', e.message);
      }
    }

    // In-memory fallback
    inMemoryAuditLogs.unshift(logEntry);
    if (inMemoryAuditLogs.length > 200) inMemoryAuditLogs.pop();
    return res.status(201).json({ success: true, source: 'memory', log: logEntry });
  }

  return res.status(405).json({ error: 'Método no permitido' });
};
