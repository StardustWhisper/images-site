# 使用官方Node.js镜像作为基础镜像
FROM node:14

# 设置工作目录
WORKDIR /usr/src/app

# 复制package.json和package-lock.json(如果存在)
COPY package*.json ./

# 安装项目依赖
RUN npm install

# 复制项目文件到工作目录
COPY . .

# 创建images目录
RUN mkdir -p public/images

# 暴露3000端口
EXPOSE 3000

# 定义环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV BASE_URL=http://localhost:3000

# 运行应用
CMD ["node", "server.js"]
