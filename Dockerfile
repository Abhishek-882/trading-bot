# -- Stage 1: Build Frontend -------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Install backend dependencies first (provides shared modules like bs58)
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Install frontend dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --legacy-peer-deps

# Copy source files
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build frontend production bundle
RUN cd frontend && npm run build

# -- Stage 2: Production Container -------------------
FROM node:20-alpine
WORKDIR /app

# Install production-only backend dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source
COPY backend/src ./src

# Copy compiled frontend from builder into public directory
COPY --from=builder /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "src/index.js"]
