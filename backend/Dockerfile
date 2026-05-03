# Build stage
FROM golang:1.26-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache gcc musl-dev sqlite-dev

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY *.go ./
COPY schema.sql ./

# Build binary
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o server .

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates sqlite-libs

# Copy binary and schema
COPY --from=builder /build/server .
COPY --from=builder /build/schema.sql .

# Create directories
RUN mkdir -p /app/data /app/uploads

EXPOSE 3000

CMD ["./server"]
