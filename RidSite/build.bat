@echo off
call hugo --destination D:\Dev\FahimFuad.github.io
call cd ..
call git add .
call git commit -a -m "Update"
call git push
pause