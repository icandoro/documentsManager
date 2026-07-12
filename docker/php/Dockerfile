FROM php:8.4-cli-alpine

RUN apk add --no-cache git icu-dev libzip-dev oniguruma-dev unzip zlib-dev \
    && docker-php-ext-install intl mbstring opcache pdo pdo_mysql zip

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/backend
