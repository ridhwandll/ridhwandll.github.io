@echo off
set /p input=
call hugo new content journey/%input%.md
pause