// api/tasks.js - Vercel Serverless Function & Local Endpoint
const { connectToDatabase } = require('../lib/mongodb');
const fs = require('fs');
const path = require('path');

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
      if (tasks.length === 0) {
        const seedPath = path.join(__dirname, '..', 'data', 'kanban_state.json');
        if (fs.existsSync(seedPath)) {
          const raw = fs.readFileSync(seedPath, 'utf8');
          const seedData = JSON.parse(raw);
          if (Array.isArray(seedData) && seedData.length > 0) {
            await collection.insertMany(seedData);
            tasks = await collection.find({}, { projection: { _id: 0 } }).toArray();
          }
        }
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
        // Replace full state
        await collection.deleteMany({});
        if (body.length > 0) {
          // Remove any Mongo internal _id before inserting
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

      // Single task insert/upsert
      if (body && body.id) {
        const copy = { ...body };
        delete copy._id;
        await collection.updateOne({ id: body.id }, { $set: copy }, { upsert: true });
        return res.status(200).json({ success: true, task: copy });
      }

      return res.status(400).json({ error: 'Payload debe ser una lista de tareas o un objeto con id' });
    }

    // PATCH /api/tasks -> Update specific task by ID
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
    console.error('[API ERROR]:', err);
    return res.status(500).json({ error: 'Error del servidor MongoDB', message: err.message });
  }
};
