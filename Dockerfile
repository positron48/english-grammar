# Stage 1: Generate indexes
FROM node:20-alpine AS builder

WORKDIR /app

COPY . .

RUN node admin/generate-index.js && \
    node test/scripts/generate-chapters-index.js

# Stage 2: Runtime (nginx + php-fpm)
FROM php:8.2-fpm-alpine

RUN apk add --no-cache nginx && \
    mkdir -p /var/www/html /var/lib/nginx/tmp /run/nginx

COPY --from=builder /app /var/www/html
COPY nginx.conf /etc/nginx/nginx.conf

# Seed dir for init container (chapters + config)
RUN mkdir -p /app/seed && \
    cp -a /var/www/html/chapters /app/seed/ && \
    cp -a /var/www/html/config /app/seed/

EXPOSE 80

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
