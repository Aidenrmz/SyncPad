import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketProvider.jsx';
import HomePage from './pages/HomePage';
import NoteEditor from './components/NoteEditor';
import './index.css';

function App() {
  return (
    <div className="dark">
      <SocketProvider>
        <Router>
          <div className="min-h-screen bg-gray-900 text-gray-100">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/notes/:noteId" element={<NoteEditor />} />
            </Routes>
          </div>
        </Router>
      </SocketProvider>
    </div>
  );
}

export default App;
