#!/bin/bash
# GitHub 仓库设置脚本
# 使用方法：./github-setup.sh <your-github-username>

if [ -z "$1" ]; then
    echo "请提供你的 GitHub 用户名"
    echo "使用方法: ./github-setup.sh <your-github-username>"
    exit 1
fi

GITHUB_USER=$1
REPO_NAME="datapull"

echo "正在设置远程仓库..."
git remote add origin "https://github.com/${GITHUB_USER}/${REPO_NAME}.git" 2>/dev/null || git remote set-url origin "https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo "正在推送代码到 GitHub..."
git branch -M main
git push -u origin main

echo "完成！"
echo "仓库地址: https://github.com/${GITHUB_USER}/${REPO_NAME}"
