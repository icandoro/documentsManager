# Documents Manager

Platforma prototip pentru administrarea si trimiterea documentelor intre utilizatori, construita cu Symfony API, MariaDB si Next.js SSR.

## Pornire locala

```bash
docker compose up --build
```

- Frontend: http://localhost:13000
- Backend health/API: http://localhost:18000/api/health
- Adminer: http://localhost:18080
- MariaDB: localhost:13306

## Stack

- PHP 8.4, compatibil cu Symfony 8.1
- Symfony `^8.1`
- MariaDB 11.4
- Next.js 16 App Router cu randare server-side implicita pentru componentele server

Symfony 8.1 cere PHP 8.4+, iar containerul foloseste `php:8.4-cli-alpine`. Backend-ul foloseste momentan PDO pentru MariaDB, deoarece Doctrine Bundle si unele bundle-uri 2FA/JWT disponibile in Composer nu declara inca suport pentru Symfony 8. Pentru productie, muta parolele si `APP_SECRET` in secret management.
