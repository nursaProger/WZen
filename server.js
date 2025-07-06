const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3005;

app.use(cors());
app.use(express.json());

// Хранилище комнат
const rooms = new Map();
const roomTimeouts = new Map(); // Таймауты для удаления комнат

// Функция для планирования удаления комнаты
const scheduleRoomDeletion = (roomId) => {
  // Отменяем предыдущий таймаут если есть
  if (roomTimeouts.has(roomId)) {
    clearTimeout(roomTimeouts.get(roomId));
  }
  
  // Планируем удаление через 30 секунд
  const timeoutId = setTimeout(() => {
    const room = rooms.get(roomId);
    if (room && room.users.length === 0) {
      rooms.delete(roomId);
      roomTimeouts.delete(roomId);
      console.log(`🏠 Комната ${roomId} удалена по таймауту (пустая)`);
    }
  }, 30000); // 30 секунд
  
  roomTimeouts.set(roomId, timeoutId);
};

// WebSocket подключения
io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  // Присоединение к комнате
  socket.on('join-room', (data) => {
    const { roomId, username } = data;
    
    // Покидаем предыдущую комнату
    if (socket.roomId) {
      socket.leave(socket.roomId);
      const room = rooms.get(socket.roomId);
      if (room) {
        room.users = room.users.filter(user => user.id !== socket.id);
        if (room.users.length === 0) {
          rooms.delete(socket.roomId);
        }
      }
    }

    // Присоединяемся к новой комнате
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    console.log(`🔗 Пользователь ${username} (${socket.id}) присоединяется к комнате ${roomId}`);

    // Создаем комнату если не существует
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        users: [],
        videoUrl: '',
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        messages: []
      });
      console.log(`🏠 Создана новая комната ${roomId}`);
    } else {
      // Если комната существует, отменяем таймаут удаления
      if (roomTimeouts.has(roomId)) {
        clearTimeout(roomTimeouts.get(roomId));
        roomTimeouts.delete(roomId);
        console.log(`⏰ Отменен таймаут удаления для комнаты ${roomId}`);
      }
    }

    const room = rooms.get(roomId);
    
    // Проверяем, не подключен ли уже этот пользователь
    const existingUserIndex = room.users.findIndex(user => user.username === username);
    if (existingUserIndex !== -1) {
      console.log(`⚠️ Пользователь ${username} уже в комнате, заменяем подключение`);
      room.users.splice(existingUserIndex, 1);
    }
    
    const user = { id: socket.id, username };
    room.users.push(user);
    
    console.log(`👥 Пользователей в комнате ${roomId}: ${room.users.length}`);
    console.log(`📋 Список пользователей:`, room.users.map(u => u.username));

    // Отправляем информацию о комнате новому пользователю
    console.log(`📋 Отправка данных комнаты пользователю ${username}:`, {
      users: room.users.length,
      videoUrl: room.videoUrl,
      isPlaying: room.isPlaying,
      currentTime: room.currentTime,
      duration: room.duration,
      messages: room.messages.length
    });
    
    socket.emit('room-data', {
      users: room.users,
      videoUrl: room.videoUrl,
      isPlaying: room.isPlaying,
      currentTime: room.currentTime,
      duration: room.duration,
      messages: room.messages
    });

    // Уведомляем всех в комнате о новом пользователе
    socket.to(roomId).emit('user-joined', user);
    
    // Обновляем список пользователей для всех в комнате
    io.to(roomId).emit('users-updated', room.users);
    
    // Отправляем системное сообщение
    const systemMessage = {
      id: Date.now().toString(),
      username: 'Система',
      text: `${username} присоединился к комнате`,
      timestamp: new Date().toISOString()
    };
    room.messages.push(systemMessage);
    io.to(roomId).emit('new-message', systemMessage);

    console.log(`Пользователь ${username} присоединился к комнате ${roomId}`);
  });

  // Отправка сообщения
  socket.on('send-message', (data) => {
    const { text } = data;
    const room = rooms.get(socket.roomId);
    
    if (room) {
      const message = {
        id: Date.now().toString(),
        username: socket.username,
        text: text,
        timestamp: new Date().toISOString()
      };
      
      room.messages.push(message);
      io.to(socket.roomId).emit('new-message', message);
    }
  });

  // Обновление состояния видео
  socket.on('video-update', (data) => {
    console.log(`🎬 ПОЛУЧЕНО СОБЫТИЕ video-update от ${socket.username}:`, data);
    
    const { videoUrl, isPlaying, currentTime, duration } = data;
    const room = rooms.get(socket.roomId);
    
    console.log(`🎬 Видео обновление в комнате ${socket.roomId}:`, {
      user: socket.username,
      videoUrl,
      isPlaying,
      currentTime,
      duration
    });
    
    if (room) {
      console.log(`📋 Комната найдена, пользователей в комнате: ${room.users.length}`);
      room.videoUrl = videoUrl;
      room.isPlaying = isPlaying;
      room.currentTime = currentTime;
      room.duration = duration;
      
      // Отправляем обновление всем в комнате, кроме отправителя
      const recipients = room.users.filter(user => user.id !== socket.id);
      console.log(`📤 Отправка синхронизации ${recipients.length} пользователям:`, recipients.map(u => u.username));
      
      if (recipients.length > 0) {
        // Используем io.to() вместо socket.to() для более надежной отправки
        io.to(socket.roomId).emit('video-sync', {
          videoUrl,
          isPlaying,
          currentTime,
          duration,
          fromUser: socket.username
        });
        console.log(`✅ Синхронизация отправлена в комнату ${socket.roomId} всем пользователям`);
      } else {
        console.log(`⚠️ Нет получателей для синхронизации в комнате ${socket.roomId}`);
      }
    } else {
      console.log(`❌ Комната ${socket.roomId} не найдена`);
    }
  });

  // Отключение пользователя
  socket.on('disconnect', () => {
    console.log(`🔌 Пользователь отключился: ${socket.username || 'Unknown'} (${socket.id})`);
    
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        console.log(`📋 Удаление пользователя ${socket.username} из комнаты ${socket.roomId}`);
        console.log(`📋 Пользователей до удаления: ${room.users.length}`);
        
        // Удаляем пользователя из списка
        const removedUser = room.users.find(user => user.id === socket.id);
        room.users = room.users.filter(user => user.id !== socket.id);
        
        console.log(`📋 Пользователей после удаления: ${room.users.length}`);
        console.log(`📋 Оставшиеся пользователи:`, room.users.map(u => u.username));
        
        // Уведомляем всех о том, что пользователь покинул комнату
        if (removedUser) {
          socket.to(socket.roomId).emit('user-left', removedUser);
          
          // Отправляем системное сообщение
          const systemMessage = {
            id: Date.now().toString(),
            username: 'Система',
            text: `${removedUser.username} покинул комнату`,
            timestamp: new Date().toISOString()
          };
          room.messages.push(systemMessage);
          io.to(socket.roomId).emit('new-message', systemMessage);
        }
        
        // Удаляем комнату если пустая
        if (room.users.length === 0) {
          console.log(`📋 Комната ${socket.roomId} пустая, планируем удаление через 30 секунд`);
          scheduleRoomDeletion(socket.roomId);
        } else {
          // Обновляем список пользователей для всех оставшихся
          io.to(socket.roomId).emit('users-updated', room.users);
        }
      }
    }
  });
});

// Прокси для обхода CORS
app.get('/proxy/*', async (req, res) => {
  try {
    const targetUrl = req.params[0];
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    res.set('Content-Type', response.headers['content-type']);
    res.send(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Парсер для Rezka.ag (улучшенный)
app.post('/parse-rezka', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url.includes('rezka.ag')) {
      return res.status(400).json({ error: 'Only Rezka.ag URLs are supported' });
    }

    console.log('Парсинг URL:', url);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://rezka.ag/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    console.log('HTML загружен, ищем плеер...');

    // Попытка найти iframe с плеером (расширенный поиск)
    let iframeSrc = null;
    
    // Ищем по различным селекторам
    const iframeSelectors = [
      'iframe[src*="player"]',
      'iframe[src*="video"]',
      'iframe[src*="embed"]',
      'iframe[src*="rezka"]',
      'iframe[src*="bazon"]',
      'iframe[src*="collaps"]',
      'iframe[src*="kinopoisk"]',
      'iframe[src*="okko"]',
      'iframe[src*="ivi"]',
      'iframe[src*="vk"]',
      'iframe[src*="youtube"]',
      'iframe[src*="vimeo"]',
      'iframe[src*="dailymotion"]',
      'iframe'
    ];

    for (const selector of iframeSelectors) {
      const iframe = $(selector).first();
      if (iframe.length > 0) {
        iframeSrc = iframe.attr('src');
        console.log('Найден iframe:', selector, iframeSrc);
        break;
      }
    }

    // Если iframe не найден, ищем в скриптах
    if (!iframeSrc) {
      const scripts = $('script');
      scripts.each((i, script) => {
        const content = $(script).html();
        if (content) {
          // Ищем URL в JavaScript коде
          const urlMatch = content.match(/['"`](https?:\/\/[^'"`]+(?:player|video|embed|rezka|bazon)[^'"`]*)['"`]/);
          if (urlMatch) {
            iframeSrc = urlMatch[1];
            console.log('Найден URL в скрипте:', iframeSrc);
            return false; // break
          }
        }
      });
    }

    if (iframeSrc) {
      // Обрабатываем относительные URL
      if (!iframeSrc.startsWith('http')) {
        if (iframeSrc.startsWith('//')) {
          iframeSrc = 'https:' + iframeSrc;
        } else if (iframeSrc.startsWith('/')) {
          iframeSrc = 'https://rezka.ag' + iframeSrc;
        } else {
          iframeSrc = 'https://rezka.ag/' + iframeSrc;
        }
      }

      console.log('Финальный URL:', iframeSrc);
      
      res.json({ 
        success: true, 
        iframeUrl: iframeSrc,
        title: $('title').text() || 'Video'
      });
    } else {
      console.log('Плеер не найден, возвращаем исходный URL');
      // Если плеер не найден, возвращаем исходный URL для iframe
      res.json({ 
        success: true, 
        iframeUrl: url,
        title: $('title').text() || 'Video'
      });
    }

  } catch (error) {
    console.error('Parse error:', error);
    // В случае ошибки возвращаем исходный URL
    res.json({ 
      success: true, 
      iframeUrl: url,
      title: 'Video'
    });
  }
});

server.listen(PORT, () => {
  console.log(`WZen server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready for real-time connections`);
}); 