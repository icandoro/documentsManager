# FROM php:8.4-cli-alpine

# RUN apk add --no-cache git icu-dev libzip-dev oniguruma-dev unzip zlib-dev \
#     && docker-php-ext-install intl mbstring opcache pdo pdo_mysql zip

# COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# WORKDIR /var/www/backend

FROM composer:2 AS vendor

WORKDIR /app

COPY backend/composer.json backend/composer.lock backend/symfony.lock ./

ENV APP_ENV=prod
ENV APP_DEBUG=0

RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

COPY backend/ ./

RUN composer dump-autoload \
    --no-dev \
    --classmap-authoritative

FROM php:8.4-cli-alpine

RUN apk add --no-cache \
        icu-libs \
        font-dejavu \
        imagemagick \
        libzip \
        oniguruma \
        tesseract-ocr \
        tesseract-ocr-data-eng \
        tesseract-ocr-data-ron \
    && apk add --no-cache --virtual .build-deps \
        icu-dev \
        libzip-dev \
        oniguruma-dev \
        zlib-dev \
    && docker-php-ext-install \
        intl \
        mbstring \
        opcache \
        pdo_mysql \
        zip \
    && apk del .build-deps

WORKDIR /var/www/backend

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY --from=vendor /app /var/www/backend
COPY docker/php/uploads.ini /usr/local/etc/php/conf.d/uploads.ini

RUN mkdir -p var/cache var/log \
    && chown -R www-data:www-data var

ENV APP_ENV=prod
ENV APP_DEBUG=0

USER www-data

EXPOSE 8000

CMD ["php", "-S", "0.0.0.0:8000", "-t", "public"]
