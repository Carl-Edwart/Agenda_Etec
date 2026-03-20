@echo off
cd /d "%~dp0"
if not exist "node_modules\" call npm install
start "" wscript.exe "%~dp0Agenda.vbs"
exit