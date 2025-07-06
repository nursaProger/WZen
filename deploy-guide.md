# 🚀 Развертывание WZen

## 🌐 Варианты хостинга

### 1. Vercel (Бесплатно, Рекомендуется)
```bash
# Установка Vercel CLI
npm install -g vercel

# Сборка проекта
npm run build

# Развертывание
vercel --prod
```

### 2. Netlify (Бесплатно)
```bash
# Сборка
npm run build

# Загрузите папку dist на netlify.com
```

### 3. Railway (Бесплатно)
```bash
# Подключите GitHub репозиторий
# Railway автоматически развернет проект
```

### 4. Heroku (Платно)
```bash
# Создайте Procfile
echo "web: npm start" > Procfile

# Развертывание
heroku create wzen-app
git push heroku main
```

## 🔧 Настройка для продакшена

### 1. Обновите package.json
```json
{
  "scripts": {
    "start": "node server.js",
    "build": "vite build"
  }
}
```

### 2. Создайте .env файл
```env
PORT=3000
NODE_ENV=production
```

### 3. Обновите CORS настройки
```javascript
// В server.js
app.use(cors({
  origin: ['https://yourdomain.com', 'http://localhost:3000']
}));
```

## 📱 Домен и SSL

### Бесплатные домены:
- `wzen.vercel.app` (Vercel)
- `wzen.netlify.app` (Netlify)
- `wzen.railway.app` (Railway)

### Кастомный домен:
1. Купите домен (например, `wzen.com`)
2. Настройте DNS записи
3. Подключите SSL сертификат

## 🔒 Безопасность

### Рекомендации:
- Используйте HTTPS
- Настройте rate limiting
- Добавьте авторизацию
- Ограничьте CORS
- Используйте переменные окружения

## 📊 Мониторинг

### Бесплатные сервисы:
- Vercel Analytics
- Netlify Analytics
- Railway Metrics

## 💰 Стоимость

### Бесплатные планы:
- Vercel: 100GB трафика/месяц
- Netlify: 100GB трафика/месяц
- Railway: $5 кредитов/месяц
- Heroku: $7/месяц

### Платные планы:
- Vercel Pro: $20/месяц
- Netlify Pro: $19/месяц
- Railway: $5-50/месяц
- Heroku: $7-25/месяц 