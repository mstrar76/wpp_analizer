import { useState, useEffect } from 'react';
import type { Chat } from '../types';
import { getAllChats } from '../services/db';

export function useChats() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadChats() {
    try {
      const allChats = await getAllChats();
      setChats(allChats);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChats();
    
    // Poll for updates every 2 seconds
    const interval = setInterval(loadChats, 2000);
    return () => clearInterval(interval);
  }, []);

  return { chats, loading, refresh: loadChats };
}
