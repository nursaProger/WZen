import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import './CreateRoom.css';

const CreateRoom: React.FC = () => {
  const [createRoomId, setCreateRoomId] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinUsername, setJoinUsername] = useState('');
  const navigate = useNavigate();

  const generateRoomId = () => {
    const newRoomId = uuidv4().substring(0, 8);
    setCreateRoomId(newRoomId);
  };

  const createRoom = () => {
    if (!createUsername.trim()) {
      alert('Пожалуйста, введите ваше имя');
      return;
    }
    if (!createRoomId.trim()) {
      alert('Пожалуйста, сгенерируйте ID комнаты');
      return;
    }
    
    // Сохраняем имя пользователя в localStorage
    localStorage.setItem('username', createUsername);
    navigate(`/room/${createRoomId}`);
  };

  const joinRoom = () => {
    if (!joinUsername.trim()) {
      alert('Пожалуйста, введите ваше имя');
      return;
    }
    if (!joinRoomId.trim()) {
      alert('Пожалуйста, введите ID комнаты');
      return;
    }
    
    localStorage.setItem('username', joinUsername);
    navigate(`/room/${joinRoomId}`);
  };

  return (
    <div className="create-room">
      <div className="header">
        <h1>🎬 WZen</h1>
        <p>Создайте комнату для совместного просмотра фильмов</p>
      </div>
      
      <div className="main-content">
        <div className="container">
          <div className="card">
            <h2>Создать новую комнату</h2>
            <input
              type="text"
              placeholder="Ваше имя"
              value={createUsername}
              onChange={(e) => setCreateUsername(e.target.value)}
              className="input"
            />
            <div className="room-id-section">
              <input
                type="text"
                placeholder="ID комнаты"
                value={createRoomId}
                onChange={(e) => setCreateRoomId(e.target.value)}
                className="input"
                readOnly
              />
              <button onClick={generateRoomId} className="btn btn-secondary">
                Сгенерировать ID
              </button>
            </div>
            <button onClick={createRoom} className="btn">
              Создать комнату
            </button>
          </div>

          <div className="card">
            <h2>Присоединиться к комнате</h2>
            <input
              type="text"
              placeholder="Ваше имя"
              value={joinUsername}
              onChange={(e) => setJoinUsername(e.target.value)}
              className="input"
            />
            <input
              type="text"
              placeholder="ID комнаты"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              className="input"
            />
            <button onClick={joinRoom} className="btn">
              Присоединиться
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateRoom; 