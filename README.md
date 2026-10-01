# Tablero Kanban — Matrícula Posgrado (UCS)

Plataforma de seguimiento y control de backlog tipo Trello para el proyecto de **Matrícula Posgrado** (Universidad Científica del Sur), con ejecución en pistas paralelas para **Ilan Valdez** (Backend), **Gary Rojas** (Frontend) y **Jaime Alfaro** (Líder Técnico & Arquitectura).

Persistencia en la nube mediante **MongoDB Atlas** y despliegue serverless optimizado para **Vercel**.

---

## 🚀 Arquitectura del Proyecto

```
kanban-matricula-posgrado/
├── api/
│   └── tasks.js             # Vercel Serverless Function (CRUD con MongoDB Atlas)
├── lib/
│   └── mongodb.js           # Módulo de conexión y pool de clientes MongoDB
├── public/
│   └── index.html           # Tablero interactivo (Kanban, Swimlanes, Drag & Drop, Filtros)
├── data/
│   └── kanban_state.json    # Semilla de datos inicial (19 tareas, 3 meses, 142 horas)
├── server.js                # Servidor local Node.js para desarrollo sin conexión
├── iniciar_tablero.bat      # Lanzador en 1 clic para Windows
├── vercel.json              # Configuración de rutas y rewrites para Vercel
├── package.json             # Dependencias (mongodb, dotenv) y scripts
├── .env.example             # Plantilla de variables de entorno
└── .gitignore               # Exclusión de credenciales y node_modules
```

---

## 🛠 Ejecución Local (Windows)

### Opción 1: En 1 Clic
Haz doble clic en el archivo [`iniciar_tablero.bat`](iniciar_tablero.bat).  
Se iniciará el servidor local y se abrirá automáticamente en tu navegador predeterminado en `http://localhost:3000`.

### Opción 2: Vía Terminal
```bash
# Instalar dependencias (si no se han instalado)
npm install

# Iniciar servidor
npm run dev
# o bien
node server.js
```

Abre en tu navegador: [http://localhost:3000](http://localhost:3000)

---

## ☁️ Conexión a MongoDB Atlas

El proyecto se conecta al clúster de **MongoDB Atlas** utilizando la base de datos `matricula_posgrado` y la colección `tasks`.

### Variables de Entorno (`.env`):
```env
MONGODB_URI=mongodb+srv://<usuario>:<password>@cientifica.zzlkch6.mongodb.net/matricula_posgrado?retryWrites=true&w=majority&appName=cientifica
MONGODB_DB=matricula_posgrado
PORT=3000
```

> **Nota de Seguridad:** El archivo `.env` está excluido de Git en `.gitignore` para no exponer credenciales en repositorios públicos.

---

## 🌐 Despliegue en Vercel

Este proyecto está 100% preparado para desplegarse con **cero configuración adicional** en Vercel:

1. Ve a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub (`jalfaro-cientifica`).
2. Haz clic en **"Add New..."** > **"Project"**.
3. Importa el repositorio: `kanban-matricula-posgrado`.
4. En la sección **Environment Variables**, añade:
   - **`MONGODB_URI`**: `mongodb+srv://jalfaroext_db_user:1D3N1CmTCig31IuK@cientifica.zzlkch6.mongodb.net/matricula_posgrado?retryWrites=true&w=majority&appName=cientifica`
   - **`MONGODB_DB`**: `matricula_posgrado`
5. Haz clic en **"Deploy"**.

¡Listo! Vercel desplegará el frontend estático y las funciones serverless de la carpeta `/api` conectadas a MongoDB Atlas.
