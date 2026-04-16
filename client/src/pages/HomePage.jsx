import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { API_URL } from '../config';

const HomePage = () => {
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'SyncPad';
  }, []);

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    setIsCreating(true);
    setCreateError('');
    try {
      const response = await axios.post(`${API_URL}/api/notes`, { title });
      navigate(`/notes/${response.data._id}`);
    } catch (error) {
      console.error('Failed to create note:', error);
      setCreateError('Could not create the pad. Try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4 py-10">
      <main className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-400 text-xl font-bold text-gray-950">
            S
          </div>
          <h1 className="text-4xl font-bold text-white">SyncPad</h1>
        </div>

        <form onSubmit={handleCreateNote} className="space-y-4">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 shadow-lg">
            <label htmlFor="note-title" className="mb-2 block text-sm font-medium text-gray-300">
              Pad title
            </label>
            <input
              type="text"
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-4 py-2 text-white placeholder-gray-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              placeholder="Untitled pad"
              autoComplete="off"
              required
            />
            {createError && (
              <p className="mt-3 text-sm text-red-300">{createError}</p>
            )}

            <button
              type="submit"
              disabled={isCreating}
              className="mt-4 flex w-full items-center justify-center rounded-md bg-cyan-500 px-4 py-2 font-medium text-gray-950 transition-colors hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              {isCreating ? 'Creating...' : 'Create pad'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default HomePage;
