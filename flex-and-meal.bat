@echo off
cd /d "%~dp0"
if not exist dist\flex-and-meal\browser\index.html call npm run build
start "" http://localhost:5173
node server.mjs
