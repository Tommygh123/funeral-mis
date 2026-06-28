#!/bin/bash

# 1. Check if git is initialized; if not, do it
if [ ! -d ".git" ]; then
  git init
fi

# 2. Add all files
git add .

# 3. Commit with a message (or a default if none is provided)
msg="${1:-Update project files}"
git commit -m "$msg"

# 4. Ensure we are on the main branch
git branch -M main

# 5. Add remote (forcefully ignore error if remote already exists)
git remote add origin https://github.com/Tommygh123/LegacyCloud.git 2>/dev/null

# 6. Push to GitHub
git push -u origin main