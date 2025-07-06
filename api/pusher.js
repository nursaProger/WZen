const Pusher = require('pusher');

// Инициализация Pusher
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "2018557",
  key: process.env.PUSHER_KEY || "9552c3255ea1afa7cf5c",
  secret: process.env.PUSHER_SECRET || "68f606d08e852efcb7dc",
  cluster: process.env.PUSHER_CLUSTER || "ap2",
  useTLS: true
});

// Глобальное хранилище для всех экземпляров
if (!global.rooms) {
  global.rooms = new Map();
}
if (!global.roomTimeouts) {
  global.roomTimeouts = new Map();
}

const rooms = global.rooms;
const roomTimeouts = global.roomTimeouts;

// Функция для планирования удаления комнаты
const scheduleRoomDeletion = (roomId) => {
  if (roomTimeouts.has(roomId)) {
    clearTimeout(roomTimeouts.get(roomId));
  }
  
  const timeoutId = setTimeout(() => {
    const room = rooms.get(roomId);
    if (room && room.users.length === 0) {
      rooms.delete(roomId);
      roomTimeouts.delete(roomId);
      console.log(`🏠 Комната ${roomId} удалена по таймауту`);
    }
  }, 30000);
  
  roomTimeouts.set(roomId, timeoutId);
};

module.exports = (req, res) => {
  console.log('📨 Получен запрос:', req.method, req.body);
  
  if (req.method === 'POST') {
    const { action, roomId, username, data } = req.body;
    console.log('🔍 Обрабатываем действие:', action, 'для комнаты:', roomId, 'пользователь:', username);

    switch (action) {
      case 'join-room':
        // Покидаем предыдущую комнату
        if (username) {
          const existingRoom = Array.from(rooms.values()).find(room => 
            room.users.some(user => user.username === username)
          );
          if (existingRoom) {
            existingRoom.users = existingRoom.users.filter(user => user.username !== username);
            if (existingRoom.users.length === 0) {
              rooms.delete(existingRoom.id);
            }
          }
        }

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
        } else {
          if (roomTimeouts.has(roomId)) {
            clearTimeout(roomTimeouts.get(roomId));
            roomTimeouts.delete(roomId);
          }
        }

        const room = rooms.get(roomId);
        
        // Удаляем существующего пользователя с таким именем
        const existingUserIndex = room.users.findIndex(user => user.username === username);
        if (existingUserIndex !== -1) {
          room.users.splice(existingUserIndex, 1);
        }
        
        // Добавляем нового пользователя
        const user = { id: Date.now().toString(), username };
        room.users.push(user);
        
        console.log('📤 Отправляем данные комнаты пользователю:', username);
        console.log('📤 Пользователей в комнате:', room.users.length);
        
        // Отправляем данные комнаты новому пользователю
        pusher.trigger(`room-${roomId}`, 'room-data', {
          users: room.users,
          videoUrl: room.videoUrl,
          isPlaying: room.isPlaying,
          currentTime: room.currentTime,
          duration: room.duration,
          messages: room.messages
        });

        // Уведомляем всех о новом пользователе
        console.log('📤 Отправляем событие user-joined для пользователя:', user.username);
        pusher.trigger(`room-${roomId}`, 'user-joined', user);
        
        console.log('📤 Отправляем обновление списка пользователей');
        pusher.trigger(`room-${roomId}`, 'users-updated', room.users);
        
        // Отправляем системное сообщение
        const systemMessage = {
          id: Date.now().toString(),
          username: 'Система',
          text: `${username} присоединился к комнате`,
          timestamp: new Date().toISOString()
        };
        room.messages.push(systemMessage);
        pusher.trigger(`room-${roomId}`, 'new-message', systemMessage);

        res.json({ success: true, user });
        break;

      case 'send-message':
        const messageRoom = rooms.get(roomId);
        if (messageRoom) {
          const message = {
            id: Date.now().toString(),
            username: username,
            text: data.text,
            timestamp: new Date().toISOString()
          };
          
          messageRoom.messages.push(message);
          pusher.trigger(`room-${roomId}`, 'new-message', message);
        }
        res.json({ success: true });
        break;

      case 'video-update':
        const videoRoom = rooms.get(roomId);
        if (videoRoom) {
          videoRoom.videoUrl = data.videoUrl;
          videoRoom.isPlaying = data.isPlaying;
          videoRoom.currentTime = data.currentTime;
          videoRoom.duration = data.duration;
          
          pusher.trigger(`room-${roomId}`, 'video-sync', {
            videoUrl: data.videoUrl,
            isPlaying: data.isPlaying,
            currentTime: data.currentTime,
            duration: data.duration,
            fromUser: username
          });
        }
        res.json({ success: true });
        break;

      case 'leave-room':
        const leaveRoom = rooms.get(roomId);
        if (leaveRoom) {
          const removedUser = leaveRoom.users.find(user => user.username === username);
          leaveRoom.users = leaveRoom.users.filter(user => user.username !== username);
          
          if (removedUser) {
            pusher.trigger(`room-${roomId}`, 'user-left', removedUser);
            
            const systemMessage = {
              id: Date.now().toString(),
              username: 'Система',
              text: `${removedUser.username} покинул комнату`,
              timestamp: new Date().toISOString()
            };
            leaveRoom.messages.push(systemMessage);
            pusher.trigger(`room-${roomId}`, 'new-message', systemMessage);
          }
          
          if (leaveRoom.users.length === 0) {
            scheduleRoomDeletion(roomId);
          } else {
            pusher.trigger(`room-${roomId}`, 'users-updated', leaveRoom.users);
          }
        }
        res.json({ success: true });
        break;

      default:
        res.status(400).json({ error: 'Unknown action' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 