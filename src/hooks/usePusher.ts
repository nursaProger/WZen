import { useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';

interface PusherMessage {
  id: string;
  username: string;
  text: string;
  timestamp: string;
}

interface PusherUser {
  id: string;
  username: string;
}

interface PusherVideoSync {
  videoUrl: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  fromUser: string;
}

interface PusherRoomData {
  users: PusherUser[];
  videoUrl: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  messages: PusherMessage[];
}

export const usePusher = (roomId: string, username: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<PusherUser[]>([]);
  const [messages, setMessages] = useState<PusherMessage[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const channelRef = useRef<any>(null);
  const pusherRef = useRef<any>(null);

  // Инициализация Pusher
  useEffect(() => {
    if (!roomId || !username) return;

    // Инициализируем Pusher
    const pusher = new Pusher(process.env.REACT_APP_PUSHER_KEY || '9552c3255ea1afa7cf5c', {
      cluster: process.env.REACT_APP_PUSHER_CLUSTER || 'ap2',
      forceTLS: true
    });

    pusherRef.current = pusher;

    // Подписываемся на канал комнаты
    const channel = pusher.subscribe(`room-${roomId}`);
    channelRef.current = channel;

    // Присоединяемся к комнате через API
    const joinRoom = async () => {
      try {
        console.log('🔗 Присоединяемся к комнате:', roomId, 'как пользователь:', username);
        const response = await fetch('/api/pusher', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'join-room',
            roomId,
            username
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Ответ от сервера:', result);
          setIsConnected(true);
          console.log('✅ Присоединились к комнате через Pusher');
        } else {
          console.error('❌ Ошибка ответа сервера:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('❌ Ошибка присоединения к комнате:', error);
      }
    };

    joinRoom();

    // Слушаем события
    channel.bind('room-data', (data: PusherRoomData) => {
      console.log('📋 Получены данные комнаты:', data);
      setUsers(data.users);
      setVideoUrl(data.videoUrl);
      setIsPlaying(data.isPlaying);
      setCurrentTime(data.currentTime);
      setDuration(data.duration);
      setMessages(data.messages);
    });

    channel.bind('user-joined', (user: PusherUser) => {
      console.log('👤 Пользователь присоединился:', user);
    });

    channel.bind('user-left', (user: PusherUser) => {
      console.log('👤 Пользователь покинул:', user);
    });

    channel.bind('users-updated', (updatedUsers: PusherUser[]) => {
      console.log('👥 Обновлен список пользователей:', updatedUsers);
      setUsers(updatedUsers);
    });

    channel.bind('new-message', (message: PusherMessage) => {
      console.log('💬 Новое сообщение:', message);
      setMessages(prev => [...prev, message]);
    });

    channel.bind('video-sync', (data: PusherVideoSync) => {
      console.log('🎬 Получена синхронизация видео от', data.fromUser, ':', data);
      
      // Игнорируем синхронизацию от самого себя
      if (data.fromUser === username) {
        console.log('⏭️ Игнорируем синхронизацию от самого себя');
        return;
      }
      
      setVideoUrl(data.videoUrl);
      setIsPlaying(data.isPlaying);
      setCurrentTime(data.currentTime);
      setDuration(data.duration);
    });

    // Очистка при размонтировании
    return () => {
      // Покидаем комнату
      fetch('/api/pusher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'leave-room',
          roomId,
          username
        })
      }).catch(console.error);

      // Отписываемся от канала
      if (channelRef.current) {
        pusher.unsubscribe(`room-${roomId}`);
      }
      
      if (pusherRef.current) {
        pusherRef.current.disconnect();
      }
    };
  }, [roomId, username]);

  // Функции для отправки данных
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    try {
      await fetch('/api/pusher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send-message',
          roomId,
          username,
          data: { text: text.trim() }
        })
      });
    } catch (error) {
      console.error('❌ Ошибка отправки сообщения:', error);
    }
  };

  const sendVideoSync = async (data: {
    videoUrl: string;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
  }) => {
    try {
      await fetch('/api/pusher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'video-update',
          roomId,
          username,
          data
        })
      });
    } catch (error) {
      console.error('❌ Ошибка синхронизации видео:', error);
    }
  };

  return {
    isConnected,
    users,
    messages,
    videoUrl,
    isPlaying,
    currentTime,
    duration,
    sendMessage,
    sendVideoSync
  };
}; 