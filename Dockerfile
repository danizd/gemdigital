# Dockerfile para o cliente web do GDT-Santiago
# Fase 1: Construcion con Vite + TypeScript
# Fase 2 (runtime): Servido por nginx con cache agresivo

# --- Etapa de construcion ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copia dependencias primeiro (aproveita cache Docker)
COPY package*.json ./
RUN npm ci --only=production=false

# Copia codigo fonte e compila
COPY . .
RUN npm run build

# --- Etapa de runtime (nginx) ---
FROM nginx:alpine

# Copia a SPA compilada ao directorio padrao de nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia configuracion personalizada de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expoe porta HTTP (TLS xestionado por nginx proxy manager externo)
EXPOSE 80

# Healthcheck simple
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
