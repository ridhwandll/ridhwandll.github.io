@echo off
set /p input=
call hugo new content posts/%input%.md
pause