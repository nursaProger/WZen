import React, { useState, useRef, useEffect } from 'react';
import './Chat.css';

interface Message {
  id: string;
  username: string;
  text: string;
  timestamp: Date | string;
}

interface ChatProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  username: string;
}

const Chat: React.FC<ChatProps> = ({ messages, onSendMessage, username }) => {
  const [inputText, setInputText] = useState('');
  const [showAllMessages, setShowAllMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Максимальное количество отображаемых сообщений
  const MAX_VISIBLE_MESSAGES = 4;
  
  // Фильтруем сообщения для отображения
  const visibleMessages = showAllMessages 
    ? messages 
    : messages.slice(-MAX_VISIBLE_MESSAGES);
  
  // Количество скрытых сообщений
  const hiddenMessagesCount = messages.length - visibleMessages.length;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const formatTime = (timestamp: Date | string) => {
    let date: Date;
    
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      date = new Date();
    }
    
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="chat">
      <div className="chat-header">
        <h3>💬 Чат</h3>
        <span className="online-indicator">●</span>
      </div>

      <div className="messages-container">
        {hiddenMessagesCount > 0 && !showAllMessages && (
          <div className="hidden-messages-indicator">
            <button 
              onClick={() => setShowAllMessages(true)}
              className="show-all-messages-btn"
            >
              📜 Показать все сообщения ({hiddenMessagesCount} скрыто)
            </button>
          </div>
        )}
        
        {visibleMessages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.username === username ? 'own-message' : ''} ${message.username === 'Система' ? 'system-message' : ''}`}
          >
            <div className="message-header">
              <span className="message-username">
                {message.username === 'Система' ? '🤖' : '👤'} {message.username}
              </span>
              <span className="message-time">
                {formatTime(message.timestamp)}
              </span>
            </div>
            <div className="message-text">
              {message.text}
            </div>
          </div>
        ))}
        
        {showAllMessages && (
          <div className="show-recent-messages">
            <button 
              onClick={() => setShowAllMessages(false)}
              className="show-recent-btn"
            >
              📋 Показать только последние {MAX_VISIBLE_MESSAGES} сообщений
            </button>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="message-input-form">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Введите сообщение..."
          className="message-input"
          maxLength={500}
        />
        <button type="submit" className="send-button" disabled={!inputText.trim()}>
          📤
        </button>
      </form>
    </div>
  );
};

export default Chat; 