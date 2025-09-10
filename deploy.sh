#!/bin/bash

# 深学助手认证系统快速部署脚本
# 使用方法: chmod +x deploy.sh && ./deploy.sh

echo "🚀 深学助手认证系统部署开始..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查必需的工具
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 未安装，请先安装 $1${NC}"
        exit 1
    fi
}

echo -e "${BLUE}📋 检查部署环境...${NC}"
check_command "node"
check_command "npm"

# 检查是否已安装 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI 未安装，正在安装...${NC}"
    npm install -g vercel
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Vercel CLI 安装成功${NC}"
    else
        echo -e "${RED}❌ Vercel CLI 安装失败${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}📦 安装项目依赖...${NC}"
npm install
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 依赖安装成功${NC}"
else
    echo -e "${RED}❌ 依赖安装失败${NC}"
    exit 1
fi

# 检查环境变量配置
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件，请先配置环境变量${NC}"
    echo -e "${BLUE}📝 请复制 .env.example 为 .env 并填入真实配置：${NC}"
    echo -e "   ${YELLOW}cp .env.example .env${NC}"
    echo -e "   ${YELLOW}然后编辑 .env 文件填入您的数据库和JWT配置${NC}"
    exit 1
fi

echo -e "${BLUE}🌐 开始部署到 Vercel...${NC}"

# 登录检查
vercel whoami > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}🔑 请先登录 Vercel...${NC}"
    vercel login
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Vercel 登录失败${NC}"
        exit 1
    fi
fi

# 部署项目
echo -e "${BLUE}🚀 正在部署项目...${NC}"
vercel --prod --confirm
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 项目部署成功！${NC}"
    
    # 获取部署URL
    VERCEL_URL=$(vercel ls | grep "https://" | head -1 | awk '{print $2}')
    if [ -n "$VERCEL_URL" ]; then
        echo -e "${GREEN}🌐 部署URL: ${VERCEL_URL}${NC}"
        
        # 提示用户更新API配置
        echo -e "${YELLOW}📝 接下来请手动更新以下文件中的 API_BASE_URL：${NC}"
        echo -e "   ${BLUE}1. extension/popup.js (第3行)${NC}"
        echo -e "   ${BLUE}2. content/loader.js (第4行)${NC}"
        echo -e "${YELLOW}   将 API_BASE_URL 更新为: ${VERCEL_URL}/api${NC}"
        
        echo -e "${BLUE}🔧 示例命令：${NC}"
        echo -e "   ${YELLOW}sed -i \"s|https://your-vercel-project.vercel.app|${VERCEL_URL}|g\" extension/popup.js${NC}"
        echo -e "   ${YELLOW}sed -i \"s|https://your-vercel-project.vercel.app|${VERCEL_URL}|g\" content/loader.js${NC}"
        
        # 询问是否自动更新
        echo -e "${BLUE}是否自动更新API配置？(y/n)${NC}"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            # 更新API URL
            sed -i "s|https://your-vercel-project.vercel.app|${VERCEL_URL}|g" extension/popup.js
            sed -i "s|https://your-vercel-project.vercel.app|${VERCEL_URL}|g" content/loader.js
            echo -e "${GREEN}✅ API配置已自动更新${NC}"
            
            # 重新构建扩展
            echo -e "${BLUE}🔨 重新构建Chrome扩展...${NC}"
            npm run build
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ 扩展构建成功！${NC}"
            else
                echo -e "${RED}❌ 扩展构建失败${NC}"
            fi
        fi
    fi
else
    echo -e "${RED}❌ 项目部署失败${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${BLUE}📋 下一步操作：${NC}"
echo -e "   ${YELLOW}1. 在 SQLPub 中执行 database/init.sql 初始化数据库${NC}"
echo -e "   ${YELLOW}2. 在 Vercel Dashboard 中设置环境变量${NC}"
echo -e "   ${YELLOW}3. 在 Chrome 中加载 dist/ 目录测试扩展${NC}"
echo -e "   ${YELLOW}4. 测试注册、登录和认证功能${NC}"

echo -e "${GREEN}✨ 深学助手认证系统部署完成！${NC}"