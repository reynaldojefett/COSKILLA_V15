@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo COSKILLA V15 - Control de obra local
echo.
if not exist "%~dp0scripts\launch.mjs" goto incomplete
if not exist "%~dp0server.mjs" goto incomplete
if not exist "%~dp0public\index.html" goto incomplete
set "COSKILLA_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "COSKILLA_NODE=C:\Users\USUARIO\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%COSKILLA_NODE%" --version >nul 2>nul
if errorlevel 1 goto missingnode
if /i "%~1"=="--check" goto check
echo La ventana debe permanecer abierta. Para detener: Ctrl+C.
echo.
"%COSKILLA_NODE%" "%~dp0scripts\launch.mjs"
if errorlevel 1 goto failed
exit /b 0

:check
"%COSKILLA_NODE%" "%~dp0scripts\launch.mjs" --check
exit /b %errorlevel%

:incomplete
echo No se encuentran todos los archivos de COSKILLA en esta carpeta.
echo Esto suele pasar al abrir el iniciador desde dentro del ZIP.
echo.
echo 1. Cierra esta ventana y busca COSKILLA_V15.zip en el Explorador.
echo 2. Haz clic derecho sobre el ZIP y elige Extraer todo.
echo 3. Abre la carpeta extraida y ejecuta INICIAR_COSKILLA.cmd desde alli.
echo.
echo Conserva juntas las carpetas scripts, public, lib, tools y server.mjs.
goto stop

:missingnode
echo No se pudo ejecutar Node.js. Instala Node.js 24 LTS desde nodejs.org.
echo Despues vuelve a abrir este iniciador.
goto stop

:failed
echo.
echo No se pudo iniciar. Revisa el mensaje anterior.
echo Si faltan archivos, vuelve a extraer TODO el ZIP en una carpeta nueva.
echo Conserva la carpeta data anterior: contiene tus obras y reportes.

:stop
if not "%COSKILLA_NO_PAUSE%"=="1" pause
exit /b 1
