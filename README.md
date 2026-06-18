# Вертикаль КП Demo Frontend

Локальный demo-фронтенд для презентации подготовки подробных КП по товарам Вертикаль из неструктурированных заявок.

## Запуск

Откройте PowerShell в папке проекта:

```powershell
cd c:\Users\[ИМЯ_ПОЛЬЗОВАТЕЛЯ]\Desktop\NuOperatorFix\NuOperator
npm install
npm run dev
```

После запуска открывайте в браузере:

```text
http://127.0.0.1:5173
```

## Почему не `localhost`

В этой среде `localhost` может резолвиться в IPv6 (`::1`) или конфликтовать с VPN/proxy-настройками Windows.

Поэтому dev-сервер и preview в проекте специально зафиксированы на:

- `127.0.0.1`
- порт `5173`

Если Vite пишет `ready`, но страница по `localhost:5173` не открывается, используйте именно:

```text
http://127.0.0.1:5173
```

## Проверка production-сборки

```powershell
npm run build
npm run preview
```

Preview также поднимается на:

```text
http://127.0.0.1:5173
```
