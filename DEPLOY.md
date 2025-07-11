# Деплой RoomParty

## 🚀 Варианты деплоя

### 1. **Vercel (Рекомендуется)**
- Бесплатный хостинг
- Автоматический деплой
- Поддержка WebSocket
- SSL сертификат включен

### 2. **Netlify**
- Бесплатный хостинг
- Простой деплой
- Ограниченная поддержка WebSocket

### 3. **Heroku**
- Платный хостинг
- Полная поддержка WebSocket
- Профессиональное решение

## 📋 Подготовка к деплою

### 1. **Сборка проекта**
```bash
npm run build
```

### 2. **Проверка файлов**
- `dist/` - собранный клиент
- `server/server.js` - сервер
- `vercel.json` - конфигурация Vercel

## 🌐 Деплой на Vercel

### **Шаг 1: Установка Vercel CLI**
```bash
npm install -g vercel
```

### **Шаг 2: Логин в Vercel**
```bash
vercel login
```

### **Шаг 3: Деплой**
```bash
vercel
```

### **Шаг 4: Продакшн деплой**
```bash
vercel --prod
```

## 🔧 Настройка окружения

### **Переменные окружения (если нужны):**
```env
NODE_ENV=production
PORT=3000
```

## 📱 После деплоя

1. **Получите URL** от Vercel
2. **Поделитесь ссылкой** с друзьями
3. **Создавайте комнаты** и смотрите видео вместе!

## 🎯 Особенности деплоя

- **WebSocket** работает через Vercel
- **Прокси-сервер** для Rutube видео
- **Автоматический SSL** сертификат
- **CDN** для быстрой загрузки

## 🆘 Решение проблем

### **WebSocket не работает:**
- Проверьте конфигурацию в `vercel.json`
- Убедитесь, что сервер запущен

### **Видео не загружается:**
- Проверьте CORS настройки
- Убедитесь, что прокси-сервер работает

### **Ошибки деплоя:**
- Проверьте логи в Vercel Dashboard
- Убедитесь, что все зависимости установлены 