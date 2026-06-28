@echo off
:: 1. Initialize Git
if not exist .git git init

:: 2. Add all files
git add .

:: 3. Commit
set /p commitMsg="Enter commit message: "
git commit -m "%commitMsg%"

:: 4. Branch and Remote
git branch -M main
git remote add origin https://github.com/Tommygh123/LegacyCloud.git 2>nul

:: 5. Push
git push -u origin main