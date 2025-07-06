import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CreateRoom from './pages/CreateRoom';
import RoomFirebase from './pages/RoomFirebase';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/create" replace />} />
          <Route path="/create" element={<CreateRoom />} />
          <Route path="/room/:roomId" element={<RoomFirebase />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 