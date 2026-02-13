@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%.."
node "%SCRIPT_DIR%deploy-cloudflare.mjs" %*
popd
endlocal
