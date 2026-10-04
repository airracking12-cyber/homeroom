@echo off
cd /d "%~dp0"
echo.
echo ===== Updating the Homeroom website =====
echo.
git add .
git diff --cached --quiet
if %errorlevel%==0 goto nochanges
git commit -m "Update %date% %time%"
git push
if errorlevel 1 goto failed
echo.
echo Done. Cloudflare is building the new version now.
echo It goes live in about a minute. Refresh the site after that.
goto end

:nochanges
echo No changes found. Nothing to publish.
goto end

:failed
echo.
echo Something went wrong while uploading. Read the message above.
echo If it says permission denied or 403, see the note about saved GitHub logins.

:end
echo.
pause
