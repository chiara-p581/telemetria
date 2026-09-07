@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_LOCAL=%~dp0.venv\Scripts\python.exe"
set "TP05_DIR=%~dp0_catedra\TP05_Desarrollo_de_Aplicaciones_II"

if not exist "%PYTHON_LOCAL%" (
  echo [ERROR] No existe el entorno .venv.
  echo Crealo e instala las dependencias indicadas en README.md.
  pause
  exit /b 1
)

"%PYTHON_LOCAL%" -c "import fastapi, uvicorn, mujoco" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Faltan fastapi, uvicorn o mujoco.
  echo Ejecuta: .venv\Scripts\python.exe -m pip install fastapi uvicorn mujoco
  pause
  exit /b 1
)

if not exist "%TP05_DIR%\INICIAR_TP05.bat" (
  echo [ERROR] No se encontro el paquete oficial TP05 en _catedra.
  pause
  exit /b 1
)

echo Abriendo dashboard en http://localhost:5500/dashboard.html
start "Dashboard web" cmd /k ""%PYTHON_LOCAL%" -m http.server 5500"
start "" "http://localhost:5500/dashboard.html"

set "PATH=%~dp0.venv\Scripts;%PATH%"
pushd "%TP05_DIR%"
call INICIAR_TP05.bat
popd

endlocal
