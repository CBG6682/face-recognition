# syntax=docker/dockerfile:1
FROM oven/bun:1-alpine AS web-builder
WORKDIR /app/web

COPY web/package.json web/bun.lock* ./
RUN bun install --frozen-lockfile

COPY web/ ./
RUN bun run build

FROM golang:1.23-alpine AS api-builder
WORKDIR /app
ENV GOTOOLCHAIN=auto

COPY api/go.mod api/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY api/ .
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server .

FROM alpine:latest
WORKDIR /app
RUN apk --no-cache add ca-certificates tzdata
ENV TZ=Asia/Ho_Chi_Minh

COPY --from=api-builder /app/server .
COPY --from=web-builder /app/web/dist ./web/dist

RUN mkdir -p /data

ENV PORT=8080
EXPOSE 8080

CMD ["./server"]

