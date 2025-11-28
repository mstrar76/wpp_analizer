import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Chats from './pages/Chats';
import SettingsPage from './pages/SettingsPage';
import { useEffect } from 'react';
import { initializeDefaultRules } from './services/db';

function App() {
  useEffect(() => {
    // Initialize database with default rules on first load
    initializeDefaultRules().catch(console.error);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="upload" element={<Upload />} />
          <Route path="chats" element={<Chats />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
