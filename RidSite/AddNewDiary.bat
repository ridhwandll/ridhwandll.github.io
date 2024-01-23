@echo off
set /p input=
call hugo new content diary/%input%.md
pause