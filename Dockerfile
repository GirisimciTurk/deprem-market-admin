# syntax=docker/dockerfile:1
# React + Vite admin paneli — statik SPA, nginx:alpine ile servis edilir.

# ---- 1) Derleme aşaması -------------------------------------------------------
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite'ın VITE_* değişkenleri BUILD anında gömülür → build-arg olarak geçilmeli.
ARG VITE_MEDUSA_BACKEND_URL
ENV VITE_MEDUSA_BACKEND_URL=$VITE_MEDUSA_BACKEND_URL

RUN npm run build            # tsc -b && vite build → dist/

# ---- 2) Çalışma aşaması (statik) ---------------------------------------------
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
