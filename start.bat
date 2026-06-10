@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ============================================================
:: start.bat - GDT-Santiago
:: Script de inicio rapido para levantar el proyecto en Windows
:: ============================================================

title GDT-Santiago - Servidor de Desarrollo
color 0B

:: Cargar variables de entorno desde .env
if not exist .env (
    echo [ERROR] No se encontro el archivo .env
    echo Creando .env desde .env.example...
    if exist .env.example (
        copy .env.example .env >nul
        echo .env creado. Por favor, editalo y vuelve a ejecutar start.bat
    ) else (
        echo [ERROR] Tampoco se encontro .env.example
        echo Creando .env con valores por defecto...
        echo PORT=5173 > .env
        echo NODE_ENV=development >> .env
    )
    pause
    exit /b 1
)

for /f "usebackq tokens=1,2 delims==" %%a in (`.env`) do (
    set "line=%%a"
    set "firstChar=!line:~0,1!"
    if not "!firstChar!"=="#" if not "!firstChar!"=="" (
        set "%%a=%%b"
    )
)

:: Usar puerto por defecto si no esta definido
if not defined PORT set PORT=5173
if not defined NODE_ENV set NODE_ENV=development

echo ============================================================
echo   GDT-Santiago - Gemelo Digital Topografico
echo ============================================================
echo.
echo   Entorno: %NODE_ENV%
echo   Puerto:  %PORT%
echo.
echo   Comandos disponibles durante ejecucion:
echo     [Ctrl+C] - Detener servidor
echo.
echo ============================================================
echo.

:: Verificar que node_modules existe
if not exist node_modules (
    echo [INFO] node_modules no encontrado. Instalando dependencias...
    echo.
    call npm install
    if errorlevel 1 (
        echo [ERROR] Fallo la instalacion de dependencias
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencias instaladas correctamente
    echo.
)

:: Verificar que dist existe (build previo)
if not exist dist (
    echo [INFO] Compilando proyecto por primera vez...
    echo.
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Fallo la compilacion
        pause
        exit /b 1
    )
    echo.
    echo [OK] Compilacion completada
    echo.
)

echo [INFO] Iniciando servidor de desarrollo Vite...
echo [INFO] Abre tu navegador en: http://localhost:%PORT%
echo.

:: Levantar el servidor de desarrollo
npm run dev -- --port %PORT%

if errorlevel 1 (
    echo.
    echo [ERROR] El servidor no pudo iniciarse. Verifica que el puerto %PORT% no este en uso.
    echo.
    pause
    exit /b 1
)
