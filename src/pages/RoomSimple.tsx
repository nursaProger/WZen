import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import Chat from '../components/Chat';
import './Room.css';

interface Message {
  id: string;
  username: string;
  text: string;
  timestamp: Date;
}

const RoomSimple: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');

  useEffect(() => {
    const savedUsername = localStorage.getItem('username');
    if (!savedUsername) {
      navigate('/create');
      return;
    }
    setUsername(savedUsername);

    // Добавляем приветственное сообщение
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      username: 'Система',
      text: `${savedUsername} присоединился к комнате ${roomId}`,
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  }, [navigate, roomId]);

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      username,
      text: text.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
  };

  const handleVideoUrlChange = (url: string) => {
    setVideoUrl(url);
  };

  const handlePlayPause = (playing: boolean) => {
    setIsPlaying(playing);
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handleDurationChange = (duration: number) => {
    setDuration(duration);
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
  };

  return (
    <div className="room">
      <div className="room-header">
        <div className="room-info">
          <h2>🎬 WZen - Комната: {roomId}</h2>
          <p>Пользователь: {username}</p>
          <div className="connection-status">
            <span className="status-dot connected">●</span>
            <span>Локальный режим (без синхронизации)</span>
          </div>
        </div>
        <div className="room-users">
          <span>👥 1 пользователь</span>
        </div>
        <button 
          onClick={() => navigate('/create')} 
          className="btn btn-secondary"
        >
          Покинуть комнату
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

export default RoomSimple; 