const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 3006;

app.use(cors());
app.use(express.json());

// Прокси для Rutube видео
app.get('/proxy/rutube/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    console.log('🎬 Прокси запрос для Rutube видео:', videoId);
    
    // Пробуем разные URL для получения embed кода
    const urls = [
      `https://rutube.ru/video/${videoId}/`,
      `https://rutube.ru/play/embed/${videoId}/`,
      `https://rutube.ru/embed/${videoId}/`,
      `https://rutube.ru/video/${videoId}`,
      `https://rutube.ru/play/embed/${videoId}`,
      `https://rutube.ru/embed/${videoId}`
    ];
    
    for (const url of urls) {
      try {
        console.log('🔍 Пробуем URL:', url);
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
            'DNT': '1',
            'Referer': 'https://rutube.ru/',
            'Origin': 'https://rutube.ru'
          },
          timeout: 15000
        });
        
        const $ = cheerio.load(response.data);
        
        // Ищем embed URL в мета-тегах или скриптах
        let embedUrl = null;
        
        // Пробуем найти в мета-тегах
        embedUrl = $('meta[property="og:video"]').attr('content') ||
                   $('meta[name="embed-url"]').attr('content') ||
                   $('meta[property="og:video:url"]').attr('content') ||
                   $('meta[property="og:video:secure_url"]').attr('content');
        
        // Пробуем найти в скриптах
        if (!embedUrl) {
          $('script').each((i, script) => {
            const content = $(script).html();
            if (content) {
              // Ищем разные паттерны embed URL
              const patterns = [
                /embed.*?["']([^"']*embed[^"']*)["']/,
                /src.*?["']([^"']*embed[^"']*)["']/,
                /url.*?["']([^"']*embed[^"']*)["']/,
                /video.*?["']([^"']*embed[^"']*)["']/,
                /player.*?["']([^"']*embed[^"']*)["']/,
                /iframe.*?["']([^"']*embed[^"']*)["']/
              ];
              
              for (const pattern of patterns) {
                const match = content.match(pattern);
                if (match && match[1]) {
                  embedUrl = match[1];
                  console.log('✅ Найден embed URL в скрипте:', embedUrl);
                  return false; // break
                }
              }
            }
          });
        }
        
        // Пробуем найти iframe src
        if (!embedUrl) {
          embedUrl = $('iframe[src*="rutube"]').attr('src') ||
                     $('iframe[src*="embed"]').attr('src') ||
                     $('iframe[src*="player"]').attr('src');
        }
        
        // Пробуем найти в data-атрибутах
        if (!embedUrl) {
          embedUrl = $('[data-embed-url]').attr('data-embed-url') ||
                     $('[data-video-url]').attr('data-video-url') ||
                     $('[data-player-url]').attr('data-player-url');
        }
        
        if (embedUrl) {
          console.log('✅ Найден embed URL:', embedUrl);
          res.json({ 
            success: true, 
            embedUrl: embedUrl.startsWith('http') ? embedUrl : `https://rutube.ru${embedUrl}`,
            originalUrl: url 
          });
          return;
        }
        
      } catch (error) {
        console.log('❌ Ошибка при запросе к URL:', url, error.message);
        continue;
      }
    }
    
    // Если ничего не найдено, возвращаем стандартный embed URL
    const fallbackUrl = `https://rutube.ru/play/embed/${videoId}/?autoplay=0&rel=0&allowfullscreen=1`;
    console.log('🔄 Возвращаем fallback URL:', fallbackUrl);
    res.json({ 
      success: true, 
      embedUrl: fallbackUrl,
      fallback: true 
    });
    
  } catch (error) {
    console.error('❌ Ошибка прокси:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Прокси для других сервисов
app.get('/proxy/*', async (req, res) => {
  try {
    const targetUrl = req.params[0];
    console.log('🌐 Прокси запрос:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://rutube.ru/'
      },
      timeout: 15000
    });
    
    res.send(response.data);
    
  } catch (error) {
    console.error('❌ Ошибка прокси:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Создаем HTML страницу с iframe для обхода X-Frame-Options
app.get('/iframe/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    console.log('🎬 Создаем iframe страницу для видео:', videoId);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rutube Video Player</title>
    <style>
        body { margin: 0; padding: 0; background: #000; }
        iframe { 
            width: 100%; 
            height: 100vh; 
            border: none; 
            display: block; 
        }
    </style>
</head>
<body>
    <iframe 
        src="https://rutube.ru/play/embed/${videoId}/?autoplay=0&rel=0&allowfullscreen=1" 
        allowfullscreen 
        allow="autoplay; encrypted-media; fullscreen">
    </iframe>
    <script>
        // Попробуем разные embed URL если первый не работает
        const iframe = document.querySelector('iframe');
        const urls = [
            'https://rutube.ru/play/embed/${videoId}/?autoplay=0&rel=0&allowfullscreen=1',
            'https://rutube.ru/embed/${videoId}/?autoplay=0&rel=0&allowfullscreen=1',
            'https://rutube.ru/video/embed/${videoId}/?autoplay=0&rel=0&allowfullscreen=1',
            'https://rutube.ru/play/embed/${videoId}/?autoplay=0&rel=0',
            'https://rutube.ru/embed/${videoId}/?autoplay=0&rel=0'
        ];
        
        let currentIndex = 0;
        
        iframe.onerror = function() {
            if (currentIndex < urls.length - 1) {
                currentIndex++;
                iframe.src = urls[currentIndex];
                console.log('Пробуем URL:', urls[currentIndex]);
            }
        };
        
        // Проверяем загрузку через 5 секунд
        setTimeout(() => {
            if (iframe.contentDocument && iframe.contentDocument.body.innerHTML.includes('error')) {
                if (currentIndex < urls.length - 1) {
                    currentIndex++;
                    iframe.src = urls[currentIndex];
                    console.log('Переключаем на URL:', urls[currentIndex]);
                }
            }
        }, 5000);
    </script>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    console.error('❌ Ошибка создания iframe страницы:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Прокси-сервер запущен на порту ${PORT}`);
  console.log(`📡 Доступен по адресу: http://localhost:${PORT}`);
}); 