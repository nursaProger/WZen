import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePusher } from '../hooks/usePusher';
import VideoPlayer from '../components/VideoPlayer';
import Chat from '../components/Chat';
import './Room.css';

interface Message {
  id: string;
  username: string;
  text: string;
  timestamp: Date | string;
}

const RoomPusher: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const lastSyncRef = useRef<number>(0);
  const userInteractionRef = useRef<boolean>(false);
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Получаем сохраненное имя пользователя
  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }

    const savedUsername = localStorage.getItem('username') || '';
    if (!savedUsername) {
      navigate('/');
      return;
    }
    setUsername(savedUsername);
  }, [roomId, navigate]);

  // Используем Pusher хук
  const {
    isConnected,
    users,
    messages,
    sendMessage,
    sendVideoSync
  } = usePusher(roomId || '', username);

  // Сохранение состояния видео в localStorage
  const saveVideoState = (newVideoUrl?: string, newIsPlaying?: boolean, newCurrentTime?: number, newDuration?: number) => {
    const currentState = JSON.parse(localStorage.getItem(`videoState_${roomId}`) || '{}');
    const newState = {
      ...currentState,
      ...(newVideoUrl !== undefined && { videoUrl: newVideoUrl }),
      ...(newIsPlaying !== undefined && { isPlaying: newIsPlaying }),
      ...(newCurrentTime !== undefined && { currentTime: newCurrentTime }),
      ...(newDuration !== undefined && { duration: newDuration }),
      timestamp: Date.now()
    };
    localStorage.setItem(`videoState_${roomId}`, JSON.stringify(newState));
  };

  // Восстанавливаем состояние видео при загрузке
  useEffect(() => {
    if (!roomId) return;

    const savedState = localStorage.getItem(`videoState_${roomId}`);
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        console.log('📝 Восстанавливаем сохраненное состояние:', state);
        
        const isStateFresh = Date.now() - (state.timestamp || 0) < 3600000;
        
        if (isStateFresh) {
          setVideoUrl(state.videoUrl || '');
          setIsPlaying(state.isPlaying || false);
          setCurrentTime(state.currentTime || 0);
          setDuration(state.duration || 0);
          console.log('✅ Состояние видео восстановлено');
        }
      } catch (error) {
        console.error('❌ Ошибка восстановления состояния видео:', error);
      }
    }
  }, [roomId]);

  const handleSendMessage = (text: string) => {
    sendMessage(text);
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

  const handleUserInteraction = () => {
    userInteractionRef.current = true;
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
    }
    userInteractionTimeoutRef.current = setTimeout(() => {
      userInteractionRef.current = false;
    }, 2000);
  };

  if (!roomId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="room">
      <div className="room-header">
        <h1>Комната: {roomId}</h1>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Подключен' : '🔴 Отключен'}
          </span>
        </div>
        <div className="users-list">
          <span>👥 Пользователи ({users.length}):</span>
          {users.map(user => (
            <span key={user.id} className="user">
              {user.username}
            </span>
          ))}
        </div>
      </div>
      
      <div className="room-content">
        <div className="video-section">
          <VideoPlayer
            url={videoUrl}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            onUrlChange={handleVideoUrlChange}
            onPlayPause={handlePlayPause}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            onSeek={handleSeek}
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

export default RoomPusher; 