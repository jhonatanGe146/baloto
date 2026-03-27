@echo off
echo =========================================
echo  Prueba de persistencia de datos
echo =========================================
echo.
echo 1. Verifica que balotas.json existe...
if exist balotas.json (
    echo    ✓ balotas.json encontrado
    type balotas.json
) else (
    echo    × balotas.json NO existe
)
echo.
echo 2. Iniciando servidor...
echo    Presiona Ctrl+C para detener
echo.
npm start
