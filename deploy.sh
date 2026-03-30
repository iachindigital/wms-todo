#!/bin/bash
# ══════════════════════════════════════════════════════════
#  WMS 宝塔部署脚本
#  在服务器上运行: bash deploy.sh
# ══════════════════════════════════════════════════════════
set -e

APP_DIR="/www/wwwroot/wms-app"    # 部署目录，可以修改

echo "▶ 1. 创建部署目录..."
mkdir -p $APP_DIR
cd $APP_DIR

echo "▶ 2. 检查 .env 文件..."
if [ ! -f ".env" ]; then
  echo "❌ 未找到 .env 文件！"
  echo "   请先执行: cp .env.template .env"
  echo "   然后填写 Supabase 的 URL、KEY 等真实值"
  exit 1
fi

echo "▶ 3. 停止旧容器（如果存在）..."
docker-compose down 2>/dev/null || true

echo "▶ 4. 构建新镜像（约3-5分钟）..."
docker-compose build --no-cache

echo "▶ 5. 启动容器..."
docker-compose up -d

echo "▶ 6. 等待启动..."
sleep 8

echo "▶ 7. 检查容器状态..."
docker-compose ps

echo "▶ 8. 查看启动日志..."
docker-compose logs --tail=20

echo ""
echo "✅ 部署完成！"
echo "   本地访问: http://localhost:3000"
echo "   如已配置域名+Nginx，访问: http://你的域名"
echo ""
echo "常用命令:"
echo "  查看日志: docker-compose logs -f"
echo "  重启:     docker-compose restart"
echo "  停止:     docker-compose down"
echo "  更新部署: bash deploy.sh"
