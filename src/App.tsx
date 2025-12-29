import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Home from './pages/Home'
import GameLobby from './pages/GameLobby'
import GameRoom from './pages/GameRoom'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <div className="app">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/lobby/:gameId" element={<GameLobby />} />
            <Route path="/room/:roomId" element={<GameRoom />} />
          </Routes>
        </div>
      </HashRouter>
    </AuthProvider>
  )
}

export default App
