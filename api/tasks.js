// api/tasks.js - Vercel Serverless Function & Local Endpoint
const { connectToDatabase } = require('../lib/mongodb');

// Require directly so Vercel's bundler includes it in the serverless artifact
let seedTasks = [];
try {
  seedTasks = require('../data/kanban_state.json');
} catch (e) {
  seedTasks = [];
}

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('tasks');

    // GET /api/tasks -> Retrieve all tasks
    if (req.method === 'GET') {
      let tasks = await collection.find({}, { projection: { _id: 0 } }).toArray();

      // Auto-seed if collection is empty
      if (tasks.length === 0 && seedTasks.length > 0) {
        await collection.insertMany(seedTasks);
        tasks = await collection.find({}, { projection: { _id: 0 } }).toArray();
      }

      return res.status(200).json(tasks);
    }

    // POST /api/tasks -> Replace or Save all tasks
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          return res.status(400).json({ error: 'JSON inválido' });
        }
      }

      if (body && !Array.isArray(body) && Array.isArray(body.value)) {
        body = body.value;
      }

      if (Array.isArray(body)) {
        await collection.deleteMany({});
        if (body.length > 0) {
          const cleanTasks = body.map(t => {
            const copy = { ...t };
            delete copy._id;
            return copy;
          });
          await collection.insertMany(cleanTasks);
        }
        const now = new Date().toLocaleTimeString();
        return res.status(200).json({ success: true, count: body.length, timestamp: now });
      }

      if (body && body.id) {
        const copy = { ...body };
        delete copy._id;
        await collection.updateOne({ id: body.id }, { $set: copy }, { upsert: true });
        return res.status(200).json({ success: true, task: copy });
      }

      return res.status(400).json({ error: 'Payload debe ser una lista de tareas o un objeto con id' });
    }

    // PATCH / PUT -> Update specific task by ID
    if (req.method === 'PATCH' || req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
      if (!body || !body.id) {
        return res.status(400).json({ error: 'Se requiere id de la tarea a actualizar' });
      }
      const copy = { ...body };
      delete copy._id;
      const result = await collection.updateOne({ id: body.id }, { $set: copy });
      return res.status(200).json({ success: true, modified: result.modifiedCount });
    }

    // DELETE /api/tasks?id=TSK-01
    if (req.method === 'DELETE') {
      const taskId = req.query ? req.query.id : null;
      if (!taskId) {
        return res.status(400).json({ error: 'Se requiere parámetro id' });
      }
      const result = await collection.deleteOne({ id: taskId });
      return res.status(200).json({ success: true, deleted: result.deletedCount });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('[API ERROR MongoDB]:', err.message);

    // Resilient Fallback on GET
    if (req.method === 'GET' && seedTasks.length > 0) {
      res.setHeader('X-Storage-Fallback', 'true');
      res.setHeader('X-Atlas-Notice', 'MongoDB Atlas IP Whitelist required');
      return res.status(200).json(seedTasks);
    }

    return res.status(500).json({
      error: 'Error de conexión a MongoDB Atlas',
      message: err.message,
      hint: 'Verifica que en MongoDB Atlas -> Network Access esté permitida la IP 0.0.0.0/0 para conexiones desde Vercel.'
    });
  }
};
