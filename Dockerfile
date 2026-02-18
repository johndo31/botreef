# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Install backend dependencies
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source
COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/

# Build backend
RUN npx tsc -p tsconfig.build.json

# Build frontend
COPY frontend/ ./frontend/
WORKDIR /app/frontend
RUN npm ci --ignore-scripts && npm run build

# Production stage
FROM node:22-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/frontend/dist/ ./frontend/dist/

# Copy config
COPY config.example.yaml ./config.example.yaml

# Create directories
RUN mkdir -p workspaces data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
