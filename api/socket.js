const { Server } = require('socket.io');

// Хранилище комнат (в памяти - будет сбрасываться при перезапуске)
const rooms = new Map();
const roomTimeouts = new Map();

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
  if (!res.socket.server.io) {
    console.log('Инициализация Socket.IO...');
    
    const io = new Server(res.socket.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    res.socket.server.io = io;
    
    io.on('connection', (socket) => {
      console.log('Пользователь подключился:', socket.id);

      // Присоединение к комнате
      socket.on('join-room', (data) => {
        const { roomId, username } = data;
        
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

        socket.join(roomId);
        socket.roomId = roomId;
        socket.username = username;

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
        
        const existingUserIndex = room.users.findIndex(user => user.username === username);
        if (existingUserIndex !== -1) {
          room.users.splice(existingUserIndex, 1);
        }
        
        const user = { id: socket.id, username };
        room.users.push(user);
        
        socket.emit('room-data', {
          users: room.users,
          videoUrl: room.videoUrl,
          isPlaying: room.isPlaying,
          currentTime: room.currentTime,
          duration: room.duration,
          messages: room.messages
        });

        socket.to(roomId).emit('user-joined', user);
        io.to(roomId).emit('users-updated', room.users);
        
        const systemMessage = {
          id: Date.now().toString(),
          username: 'Система',
          text: `${username} присоединился к комнате`,
          timestamp: new Date().toISOString()
        };
        room.messages.push(systemMessage);
        io.to(roomId).emit('new-message', systemMessage);
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
        const { videoUrl, isPlaying, currentTime, duration } = data;
        const room = rooms.get(socket.roomId);
        
        if (room) {
          room.videoUrl = videoUrl;
          room.isPlaying = isPlaying;
          room.currentTime = currentTime;
          room.duration = duration;
          
          io.to(socket.roomId).emit('video-sync', {
            videoUrl,
            isPlaying,
            currentTime,
            duration,
            fromUser: socket.username
          });
        }
      });

      // Отключение пользователя
      socket.on('disconnect', () => {
        if (socket.roomId) {
          const room = rooms.get(socket.roomId);
          if (room) {
            const removedUser = room.users.find(user => user.id === socket.id);
            room.users = room.users.filter(user => user.id !== socket.id);
            
            if (removedUser) {
              socket.to(socket.roomId).emit('user-left', removedUser);
              
              const systemMessage = {
                id: Date.now().toString(),
                username: 'Система',
                text: `${removedUser.username} покинул комнату`,
                timestamp: new Date().toISOString()
              };
              room.messages.push(systemMessage);
              io.to(socket.roomId).emit('new-message', systemMessage);
            }
            
            if (room.users.length === 0) {
              scheduleRoomDeletion(socket.roomId);
            } else {
              io.to(socket.roomId).emit('users-updated', room.users);
            }
          }
        }
      });
    });
  }
  
  res.end();
}; 