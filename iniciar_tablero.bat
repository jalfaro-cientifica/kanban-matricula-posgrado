@echo off
title Tablero Kanban Matricula Posgrado - MongoDB Atlas
echo ======================================================================
echo   Iniciando Tablero Kanban Matricula Posgrado (UCS)
echo   Lider: Jaime Alfaro
echo   Base de Datos: MongoDB Atlas (cientifica.zzlkch6.mongodb.net)
echo ======================================================================
echo.

:: Abrir navegador predeterminado en localhost:3000 tras 1.5 segundos
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000"

:: Ejecutar servidor Node.js conectado a MongoDB Atlas
node server.js

pause
