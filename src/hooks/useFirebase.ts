import { useEffect, useState, useRef } from 'react';
import { 
  ref, 
  onValue, 
  push, 
  set, 
  remove, 
  serverTimestamp,
  DatabaseReference 
} from 'firebase/database';
import { database } from '../firebase';

interface FirebaseMessage {
  id: string;
  username: string;
  text: string;
  timestamp: string;
}

interface FirebaseUser {
  id: string;
  username: string;
  joinedAt: string;
}

interface FirebaseVideoState {
  videoUrl: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
}

interface FirebaseRoomData {
  users: FirebaseUser[];
  videoState: FirebaseVideoState;
  messages: FirebaseMessage[];
}

export const useFirebase = (roomId: string, username: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<FirebaseUser[]>([]);
  const [messages, setMessages] = useState<FirebaseMessage[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const userRef = useRef<DatabaseReference | null>(null);
  const roomRef = useRef<DatabaseReference | null>(null);

  // Инициализация Firebase
  useEffect(() => {
    if (!roomId || !username) return;

    console.log('🔥 Инициализация Firebase для комнаты:', roomId, 'пользователь:', username);
    
    // Ссылки на данные
    roomRef.current = ref(database, `rooms/${roomId}`);
    userRef.current = ref(database, `rooms/${roomId}/users/${username}`);

    // Присоединяемся к комнате
    const joinRoom = async () => {
      try {
        const userData: FirebaseUser = {
          id: username,
          username: username,
          joinedAt: new Date().toISOString()
        };

        // Добавляем пользователя в комнату
        await set(userRef.current!, userData);
        
        // Добавляем системное сообщение
        const messageRef = ref(database, `rooms/${roomId}/messages`);
        const newMessage: FirebaseMessage = {
          id: Date.now().toString(),
          username: 'Система',
          text: `${username} присоединился к комнате`,
          timestamp: new Date().toISOString()
        };
        await push(messageRef, newMessage);

        setIsConnected(true);
        console.log('✅ Присоединились к комнате через Firebase');
      } catch (error) {
        console.error('❌ Ошибка присоединения к комнате:', error);
      }
    };

    joinRoom();

    // Слушаем изменения в комнате
    const unsubscribeRoom = onValue(roomRef.current, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        console.log('📋 Получены данные комнаты:', data);
        
        // Обновляем пользователей
        if (data.users) {
          const usersList = Object.values(data.users) as FirebaseUser[];
          setUsers(usersList);
          console.log('👥 Пользователей в комнате:', usersList.length);
        }
        
        // Обновляем сообщения
        if (data.messages) {
          const messagesList = Object.values(data.messages) as FirebaseMessage[];
          setMessages(messagesList);
          console.log('💬 Сообщений в чате:', messagesList.length);
        }
        
        // Обновляем состояние видео
        if (data.videoState) {
          const videoState = data.videoState as FirebaseVideoState;
          setVideoUrl(videoState.videoUrl || '');
          setIsPlaying(videoState.isPlaying || false);
          setCurrentTime(videoState.currentTime || 0);
          setDuration(videoState.duration || 0);
          console.log('🎬 Обновлено состояние видео от:', videoState.lastUpdatedBy);
        }
      }
    });

    // Очистка при размонтировании
    return () => {
      console.log('🔌 Отключаемся от Firebase');
      unsubscribeRoom();
      
      // Удаляем пользователя из комнаты
      if (userRef.current) {
        remove(userRef.current).catch(console.error);
      }
      
      // Добавляем сообщение о выходе
      if (roomRef.current) {
        const messageRef = ref(database, `rooms/${roomId}/messages`);
        const leaveMessage: FirebaseMessage = {
          id: Date.now().toString(),
          username: 'Система',
          text: `${username} покинул комнату`,
          timestamp: new Date().toISOString()
        };
        push(messageRef, leaveMessage).catch(console.error);
      }
    };
  }, [roomId, username]);

  // Функции для отправки данных
  const sendMessage = async (text: string) => {
    if (!text.trim() || !roomRef.current) return;

    try {
      const messageRef = ref(database, `rooms/${roomId}/messages`);
      const newMessage: FirebaseMessage = {
        id: Date.now().toString(),
        username: username,
        text: text.trim(),
        timestamp: new Date().toISOString()
      };
      await push(messageRef, newMessage);
      console.log('💬 Сообщение отправлено:', text);
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
    if (!roomRef.current) return;

    try {
      const videoStateRef = ref(database, `rooms/${roomId}/videoState`);
      const videoState: FirebaseVideoState = {
        ...data,
        lastUpdatedBy: username,
        lastUpdatedAt: new Date().toISOString()
      };
      await set(videoStateRef, videoState);
      console.log('🎬 Синхронизация видео отправлена:', data);
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