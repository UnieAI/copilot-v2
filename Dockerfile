# ==============================
# 階段 1：建置階段 (builder)
# ==============================
FROM node:18-alpine AS builder

WORKDIR /app

# 先複製 package 相關檔案，充分利用 Docker 快取
COPY package*.json ./
COPY tsconfig*.json ./
COPY next.config.* ./

# 安裝所有依賴（包含開發依賴）
RUN npm ci

# 複製所有原始碼
COPY . .

# 執行 Next.js 建置
RUN npm run build

# ==============================
# 階段 2：執行階段 (輕量生產映像)
# ==============================
FROM node:18-alpine AS runner

# 設定為生產環境
ENV NODE_ENV=production

WORKDIR /app

# 只複製必要的檔案到最終映像
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# 如果你有這些設定檔，也要複製（視專案需要）
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/tsconfig*.json ./

# 安裝生產環境依賴（不包含 devDependencies）
RUN npm ci --omit=dev --frozen-lockfile

# 確保權限（alpine 常見做法）
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# 暴露埠號
EXPOSE 3000

# 啟動命令
ENV PORT=3000
CMD ["npm", "start"]