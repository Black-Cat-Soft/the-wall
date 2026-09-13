# Build stage
FROM golang:1.26-alpine3.23 AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache gcc musl-dev sqlite-dev

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY *.go ./
COPY *.sql ./

# Build binary
RUN CGO_ENABLED=1 go build -trimpath -ldflags="-s -w" -o server .

# Runtime stage
FROM alpine:3.23

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates sqlite-libs

# The binary includes the embedded schema and optional demo data.
COPY --from=builder /build/server .

# Create directories
RUN addgroup -g 10001 app && adduser -D -H -u 10001 -G app app \
    && mkdir -p /app/data /app/uploads \
    && chown -R app:app /app/data /app/uploads

USER 10001:10001
ENV PORT=3000 DATABASE_URL=/app/data/app.db SEED_DEMO_DATA=false

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1

CMD ["./server"]
