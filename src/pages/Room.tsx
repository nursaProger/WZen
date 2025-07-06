import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import VideoPlayer from '../components/VideoPlayer';
import Chat from '../components/Chat';
import './Room.css';

interface Message {
  id: string;
  username: string;
  text: string;
  timestamp: Date | string;
}

const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [users, setUsers] = useState<Array<{id: string, username: string}>>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const lastSyncRef = useRef<number>(0);

  // Функция сохранения состояния видео
  const saveVideoState = (newVideoUrl?: string, newIsPlaying?: boolean, newCurrentTime?: number, newDuration?: number) => {
    const state = {
      videoUrl: newVideoUrl !== undefined ? newVideoUrl : videoUrl,
      isPlaying: newIsPlaying !== undefined ? newIsPlaying : isPlaying,
      currentTime: newCurrentTime !== undefined ? newCurrentTime : currentTime,
      duration: newDuration !== undefined ? newDuration : duration
    };
    
    console.log('💾 Сохраняем состояние видео для комнаты:', roomId);
    console.log('💾 Данные для сохранения:', state);
    
    localStorage.setItem(`video-state-${roomId}`, JSON.stringify(state));
    
    // Проверяем, что данные сохранились
    const saved = localStorage.getItem(`video-state-${roomId}`);
    console.log('💾 Проверка сохранения:', saved ? '✅ Успешно' : '❌ Не найдено');
  };

  // Функция отправки синхронизации с debounce
  const sendVideoSync = (updateData: any) => {
    const now = Date.now();
    if (now - lastSyncRef.current < 100) { // Задержка 100мс между синхронизациями
      return;
    }
    lastSyncRef.current = now;
    
    if (socket) {
      console.log('📤 Отправка синхронизации:', updateData);
      socket.emit('video-update', updateData);
    }
  };

  useEffect(() => {
    const savedUsername = localStorage.getItem('username');
    if (!savedUsername) {
      navigate('/create');
      return;
    }
    setUsername(savedUsername);

    // Восстанавливаем состояние видео из localStorage
    const savedVideoState = localStorage.getItem(`video-state-${roomId}`);
    console.log('🔍 Проверяем сохраненное состояние для комнаты:', roomId);
    console.log('🔍 Найденные данные в localStorage:', savedVideoState);
    
    // Логируем все ключи localStorage для отладки
    console.log('🔍 Все ключи localStorage:', Object.keys(localStorage));
    
    if (savedVideoState) {
      try {
        const state = JSON.parse(savedVideoState);
        console.log('🔄 Восстанавливаем состояние видео:', state);
        
        // Применяем состояние сразу
        setVideoUrl(state.videoUrl || '');
        setIsPlaying(state.isPlaying || false);
        setCurrentTime(state.currentTime || 0);
        setDuration(state.duration || 0);
        
        console.log('✅ Состояние восстановлено успешно');
      } catch (error) {
        console.error('❌ Ошибка восстановления состояния видео:', error);
      }
    } else {
      console.log('📝 Сохраненное состояние не найдено');
    }

    // Подключаемся к WebSocket серверу
    const socketUrl = process.env.NODE_ENV === 'production' 
      ? `${window.location.origin}/api/socket` 
      : 'http://localhost:3005';
    const newSocket = io(socketUrl, {
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
      forceNew: true
    });
    setSocket(newSocket);

    // Присоединяемся к комнате только после успешного подключения
    newSocket.on('connect', () => {
      console.log('✅ Подключен к серверу WebSocket, присоединяемся к комнате');
      newSocket.emit('join-room', { roomId, username: savedUsername });
    });

    // Слушаем события
    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('✅ Подключен к серверу WebSocket');
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('❌ Отключен от сервера WebSocket:', reason);
      
      // Если отключение не по инициативе пользователя, пытаемся переподключиться
      if (reason === 'io server disconnect') {
        console.log('🔄 Сервер отключил нас, пытаемся переподключиться...');
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Ошибка подключения к серверу:', error);
      setIsConnected(false);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Переподключение успешно, попытка:', attemptNumber);
      setIsConnected(true);
      // Переприсоединяемся к комнате после переподключения
      newSocket.emit('join-room', { roomId, username: savedUsername });
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('❌ Ошибка переподключения:', error);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Не удалось переподключиться после всех попыток');
    });

    newSocket.on('error', (error) => {
      console.error('❌ Ошибка WebSocket:', error);
      setIsConnected(false);
    });

    newSocket.on('room-data', (data) => {
      console.log('📋 Получены данные комнаты:', data);
      console.log('🎬 Текущий URL видео в комнате:', data.videoUrl);
      console.log('⏯️ Состояние воспроизведения:', data.isPlaying);
      setUsers(data.users);
      setVideoUrl(data.videoUrl);
      setIsPlaying(data.isPlaying);
      setCurrentTime(data.currentTime);
      setDuration(data.duration);
      setMessages(data.messages);
    });

    newSocket.on('user-joined', (user) => {
      console.log('👤 Пользователь присоединился:', user);
      // Не добавляем пользователя вручную, ждем обновления от сервера
    });

    newSocket.on('user-left', (user) => {
      console.log('👤 Пользователь покинул:', user);
      // Не удаляем пользователя вручную, ждем обновления от сервера
    });

    newSocket.on('users-updated', (updatedUsers) => {
      console.log('👥 Обновлен список пользователей:', updatedUsers);
      setUsers(updatedUsers);
    });

    newSocket.on('new-message', (message) => {
      console.log('💬 Новое сообщение:', message);
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('video-sync', (data) => {
      console.log('🎬 Получена синхронизация видео от', data.fromUser, ':', {
        videoUrl: data.videoUrl,
        isPlaying: data.isPlaying,
        currentTime: data.currentTime,
        duration: data.duration
      });
      
      // Игнорируем синхронизацию от самого себя
      if (data.fromUser === username) {
        console.log('⏭️ Игнорируем синхронизацию от самого себя');
        return;
      }
      
      // Применяем синхронизацию только если данные отличаются от текущих
      let hasChanges = false;
      
      if (data.videoUrl !== videoUrl) {
        console.log('🔄 Обновляем URL видео:', data.videoUrl);
        setVideoUrl(data.videoUrl);
        saveVideoState(data.videoUrl);
        hasChanges = true;
      }
      
      if (data.isPlaying !== isPlaying) {
        console.log('🔄 Обновляем состояние воспроизведения:', data.isPlaying);
        setIsPlaying(data.isPlaying);
        saveVideoState(undefined, data.isPlaying);
        hasChanges = true;
      }
      
      if (Math.abs(data.currentTime - currentTime) > 0.5) { // Разница больше 0.5 секунд
        console.log('🔄 Обновляем время воспроизведения:', data.currentTime);
        setCurrentTime(data.currentTime);
        saveVideoState(undefined, undefined, data.currentTime);
        hasChanges = true;
      }
      
      if (data.duration !== duration) {
        console.log('🔄 Обновляем длительность:', data.duration);
        setDuration(data.duration);
        saveVideoState(undefined, undefined, undefined, data.duration);
        hasChanges = true;
      }
      
      if (hasChanges) {
        console.log('✅ Применены изменения синхронизации от', data.fromUser);
      } else {
        console.log('⏭️ Изменения не требуются');
      }
    });

    return () => {
      newSocket.close();
    };
  }, [navigate, roomId]);

  const handleSendMessage = (text: string) => {
    if (!text.trim() || !socket) return;
    socket.emit('send-message', { text: text.trim() });
  };

  const handleVideoUrlChange = (url: string) => {
    console.log('🔗 Изменение URL видео:', url);
    setVideoUrl(url);
    saveVideoState(url);
    const updateData = {
      videoUrl: url,
      isPlaying,
      currentTime,
      duration
    };
    sendVideoSync(updateData);
  };

  const handlePlayPause = (playing: boolean) => {
    console.log('⏯️ Изменение состояния воспроизведения:', playing);
    setIsPlaying(playing);
    saveVideoState(undefined, playing);
    const updateData = {
      videoUrl,
      isPlaying: playing,
      currentTime,
      duration
    };
    sendVideoSync(updateData);
  };

  const handleTimeUpdate = (time: number) => {
    console.log('⏰ Обновление времени:', time);
    setCurrentTime(time);
    saveVideoState(undefined, undefined, time);
    const updateData = {
      videoUrl,
      isPlaying,
      currentTime: time,
      duration
    };
    sendVideoSync(updateData);
  };

  const handleDurationChange = (duration: number) => {
    console.log('📏 Изменение длительности:', duration);
    setDuration(duration);
    saveVideoState(undefined, undefined, undefined, duration);
    const updateData = {
      videoUrl,
      isPlaying,
      currentTime,
      duration
    };
    sendVideoSync(updateData);
  };

  const handleSeek = (time: number) => {
    console.log('🎯 Перемотка к времени:', time);
    setCurrentTime(time);
    saveVideoState(undefined, undefined, time);
    const updateData = {
      videoUrl,
      isPlaying,
      currentTime: time,
      duration
    };
    sendVideoSync(updateData);
  };

  return (
    <div className="room">
      <div className="room-header">
        <div className="room-info">
          <h2>🎬 WZen - Комната: {roomId}</h2>
          <p>👤 Пользователь: {username}</p>
          <div className="connection-status">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '●' : '○'}
            </span>
            <span>{isConnected ? 'Подключено' : 'Отключено'}</span>
            {isConnected && <span style={{marginLeft: '8px', fontSize: '0.8rem', opacity: 0.7}}>• Синхронизация активна</span>}
          </div>
        </div>
        <div className="room-users">
          <span>👥 {users.length} {users.length === 1 ? 'пользователь' : users.length < 5 ? 'пользователя' : 'пользователей'}</span>
          {users.length > 0 && (
            <span style={{fontSize: '0.8rem', opacity: 0.7}}>
              • {users.map(u => u.username).join(', ')}
            </span>
          )}
        </div>
        <button 
          onClick={() => navigate('/create')} 
          className="btn btn-secondary"
        >
          🚪 Покинуть комнату
        </button>
      </div>

      <div className="room-container">
        <div className="video-section">
          <VideoPlayer
            url={videoUrl}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            onPlayPause={handlePlayPause}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            onSeek={handleSeek}
            onUrlChange={handleVideoUrlChange}
          />
        </div>

        <div className="chat-section">
          <Chat
            messages={messages}
            onSendMessage={handleSendMessage}
            username={username}
          />
        </div>
      </div>
    </div>
  );
};

export default Room; 