# =============================================================================
# Stage 1: Build the Next.js static frontend bundle
# =============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# =============================================================================
# Stage 2: Compile the Go binary
# =============================================================================
FROM golang:1.23-alpine AS go-builder
WORKDIR /app/go-backend

COPY go-backend/go.mod go-backend/go.sum ./
RUN go mod download

COPY go-backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/bin/nexus-server .

# =============================================================================
# Stage 3: Minimal, ultra-secure production runtime container
# =============================================================================
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata wget curl

WORKDIR /app

# Copy static frontend and backend binary
COPY --from=frontend-builder /app/frontend/out /app/public
COPY --from=go-builder /app/bin/nexus-server /app/nexus-server

RUN chmod +x /app/nexus-server

# Create storage and data directories
RUN mkdir -p /app/data /app/data/storage /app/data/uploads

ENV PORT=5000 \
    ENVIRONMENT=production \
    STORAGE_PATH=/app/data

EXPOSE 5000

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:5000/ || exit 1

CMD ["/app/nexus-server"]
