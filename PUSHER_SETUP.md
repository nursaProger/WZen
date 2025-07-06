# Настройка Pusher для WebSocket

## Шаг 1: Создание аккаунта Pusher

1. Перейдите на https://pusher.com/
2. Зарегистрируйтесь (бесплатный план включает 200,000 сообщений в день)
3. Создайте новое приложение

## Шаг 2: Получение ключей

После создания приложения вы получите:
- App ID
- Key
- Secret
- Cluster (обычно "eu" или "us2")

## Шаг 3: Настройка переменных окружения

### Для локальной разработки:
Создайте файл `.env` в корне проекта:
```
REACT_APP_PUSHER_KEY=your-pusher-key
REACT_APP_PUSHER_CLUSTER=eu
```

### Для Vercel:
Добавьте переменные окружения в настройках Vercel:
- `PUSHER_APP_ID` = ваш App ID
- `PUSHER_KEY` = ваш Key
- `PUSHER_SECRET` = ваш Secret
- `PUSHER_CLUSTER` = ваш Cluster

## Шаг 4: Обновление кода

Обновите файлы:
1. `api/pusher.js` - замените placeholder значения на реальные
2. `src/hooks/usePusher.ts` - замените placeholder значения на реальные

## Шаг 5: Тестирование

1. Запустите локальный сервер: `npm run dev`
2. Откройте сайт в двух браузерах
3. Создайте комнату и проверьте синхронизацию

## Альтернативы Pusher

Если Pusher не подходит, можно использовать:
- Firebase Realtime Database
- Supabase Realtime
- Ably
- PubNub 