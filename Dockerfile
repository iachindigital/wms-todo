FROM node:20-alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps \
    --cache /tmp/npm-cache \
    --maxsockets 1 \
    && rm -rf /tmp/npm-cache

COPY . .

# ── PocketBase 配置（运行时通过环境变量传入，构建时只需占位）
ARG NEXT_PUBLIC_DEFAULT_TENANT_ID
ENV NEXT_PUBLIC_DEFAULT_TENANT_ID=$NEXT_PUBLIC_DEFAULT_TENANT_ID
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN node --max-old-space-size=1536 ./node_modules/.bin/next build

EXPOSE 3000
CMD ["npm", "start"]
