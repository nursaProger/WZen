import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CreateRoom from './pages/CreateRoom';
import RoomPusher from './pages/RoomPusher';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/create" replace />} />
          <Route path="/create" element={<CreateRoom />} />
          <Route path="/room/:roomId" element={<RoomPusher />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 