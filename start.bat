@echo off
echo.
echo  ╔═══════════════════════════════════╗
echo  ║       BizPilot AI Launcher        ║
echo  ╚═══════════════════════════════════╝
echo.
echo  Starting Backend on port 3001...
start "BizPilot Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 2 /nobreak > nul
echo  Starting Frontend on port 5173...
start "BizPilot Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo.
echo  ✓ Backend: http://localhost:3001/health
echo  ✓ Frontend: http://localhost:5173
echo.
pause
