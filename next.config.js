/** @type {import('next').NextConfig} */
const nextConfig = {
  // ⚠️ Docker 部署必须加这一行，生成独立服务器文件
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
