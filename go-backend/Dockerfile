# Stage 1: Build the Next.js static frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Go backend binaries
FROM golang:1.23-alpine AS go-builder
WORKDIR /app/go-backend
COPY go-backend/go.mod go-backend/go.sum ./
RUN go mod download
COPY go-backend/ ./
RUN CGO_ENABLED=0 go build -o /app/bin/invoice-server .
RUN CGO_ENABLED=0 go build -o /app/bin/invoice-seed ./cmd/seed
RUN CGO_ENABLED=0 go build -o /app/bin/migrate ./cmd/migrate

# Stage 3: Runtime
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

# Copy the static export and compiled binaries
COPY --from=frontend-builder /app/frontend/out /app/public
COPY --from=go-builder /app/bin/invoice-server /app/invoice-server
COPY --from=go-builder /app/bin/invoice-seed /app/invoice-seed
COPY --from=go-builder /app/bin/migrate /app/migrate

RUN chmod +x /app/invoice-server /app/invoice-seed /app/migrate

ENV PORT=5000 \
    ENVIRONMENT=production \
    STORAGE_PATH=/app/data

EXPOSE 5000
CMD ["/app/invoice-server"]

