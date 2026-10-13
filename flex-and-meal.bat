@echo off
cd /d "%~dp0"
if not exist dist\index.html call npm run build
start "" http://localhost:5173
npm run preview
