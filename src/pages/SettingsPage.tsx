import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, RefreshCw, Save, Eye, EyeOff, X, Edit2, Check } from 'lucide-react';
import type { IdentifierRule, LeadChannel, ChannelConfig } from '../types';
import { getAllRules, addRule, deleteRule, getAllChannels, addChannel, updateChannel, deleteChannel, initializeDefaultChannels } from '../services/db';
import { getApiKey, saveApiKey, testApiKey } from '../services/gemini';
import { reprocessAllChats } from '../services/processingQueue';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<'success' | 'error' | null>(null);
  const [rules, setRules] = useState<IdentifierRule[]>([]);
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newChannel, setNewChannel] = useState<LeadChannel>('Facebook');
  const [isReprocessing, setIsReprocessing] = useState(false);
  
  // Channel management state
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelKeywords, setNewChannelKeywords] = useState('');
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editingKeywords, setEditingKeywords] = useState('');

  // Load initial data
  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const storedKey = getApiKey();
    if (storedKey) {
      setApiKey(storedKey);
    }

    const storedRules = await getAllRules();
    setRules(storedRules);

    // Load channels (initialize defaults if needed)
    await initializeDefaultChannels();
    const storedChannels = await getAllChannels();
    setChannels(storedChannels);
  }

  async function handleSaveApiKey() {
    if (!apiKey.trim()) {
      alert('Please enter an API key');
      return;
    }

    setIsTestingKey(true);
    setKeyTestResult(null);

    try {
      const isValid = await testApiKey(apiKey);
      if (isValid) {
        saveApiKey(apiKey);
        setKeyTestResult('success');
        setTimeout(() => setKeyTestResult(null), 3000);
      } else {
        setKeyTestResult('error');
        alert('Invalid API key. Please check and try again.');
      }
    } catch (error) {
      setKeyTestResult('error');
      alert('Failed to test API key. Please try again.');
    } finally {
      setIsTestingKey(false);
    }
  }

  async function handleAddRule() {
    if (!newKeyword.trim()) {
      alert('Please enter a keyword');
      return;
    }

    const newRule: IdentifierRule = {
      id: crypto.randomUUID(),
      keyword: newKeyword.trim(),
      channel: newChannel,
      createdAt: Date.now(),
    };

    await addRule(newRule);
    setRules([...rules, newRule]);
    setNewKeyword('');
  }

  async function handleDeleteRule(ruleId: string) {
    if (confirm('Are you sure you want to delete this rule?')) {
      await deleteRule(ruleId);
      setRules(rules.filter((r) => r.id !== ruleId));
    }
  }

  async function handleReprocessAll() {
    if (!confirm('This will reprocess ALL chats with the current rules. Continue?')) {
      return;
    }

    setIsReprocessing(true);
    try {
      await reprocessAllChats(rules);
      alert('Reprocessing started! Check the Dashboard for progress.');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsReprocessing(false);
    }
  }

  const channelNames = channels.map(c => c.name);

  // Channel management handlers
  async function handleAddChannel() {
    if (!newChannelName.trim()) {
      alert('Please enter a channel name');
      return;
    }

    if (channels.some(c => c.name.toLowerCase() === newChannelName.trim().toLowerCase())) {
      alert('A channel with this name already exists');
      return;
    }

    const keywords = newChannelKeywords
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);

    const channel: ChannelConfig = {
      id: crypto.randomUUID(),
      name: newChannelName.trim(),
      keywords,
      isDefault: false,
      createdAt: Date.now(),
    };

    await addChannel(channel);
    setChannels([...channels, channel]);
    setNewChannelName('');
    setNewChannelKeywords('');
  }

  async function handleUpdateChannelKeywords(channelId: string) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;

    const keywords = editingKeywords
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);

    const updatedChannel = { ...channel, keywords };
    await updateChannel(updatedChannel);
    setChannels(channels.map(c => c.id === channelId ? updatedChannel : c));
    setEditingChannelId(null);
    setEditingKeywords('');
  }

  async function handleDeleteChannel(channelId: string) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;

    if (channel.isDefault) {
      alert('Cannot delete default channels. You can edit their keywords instead.');
      return;
    }

    if (!confirm(`Delete channel "${channel.name}"?`)) return;

    await deleteChannel(channelId);
    setChannels(channels.filter(c => c.id !== channelId));
  }

  function startEditingChannel(channel: ChannelConfig) {
    setEditingChannelId(channel.id);
    setEditingKeywords(channel.keywords.join(', '));
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-600 mb-8">Configure your API key and channel identification rules</p>

      {/* API Key Section */}
      <div className="card mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Key className="text-blue-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Google Gemini API Key</h2>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Get your API key from{' '}
          <a
            href="https://makersuite.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Google AI Studio
          </a>
        </p>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API key"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              onClick={handleSaveApiKey}
              disabled={isTestingKey}
              className="btn-primary flex items-center gap-2"
            >
              {isTestingKey ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save & Test
                </>
              )}
            </button>
          </div>

          {keyTestResult === 'success' && (
            <div className="text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg">
              ✓ API key validated and saved successfully!
            </div>
          )}
          {keyTestResult === 'error' && (
            <div className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
              ✗ API key validation failed. Please check your key.
            </div>
          )}
        </div>
      </div>

      {/* Channel Sources Configuration */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Channel Sources</h2>
        <p className="text-sm text-gray-600 mb-6">
          Configure the available lead sources/channels and their detection keywords.
          Keywords are used to automatically identify the channel from conversation content.
        </p>

        {/* Add New Channel */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            placeholder="New channel name (e.g., 'Mercado Livre')"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="text"
            value={newChannelKeywords}
            onChange={(e) => setNewChannelKeywords(e.target.value)}
            placeholder="Keywords (comma-separated)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button onClick={handleAddChannel} className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            Add Channel
          </button>
        </div>

        {/* Channels List */}
        <div className="space-y-3">
          {channels.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Loading channels...
            </div>
          ) : (
            channels.map((channel) => (
              <div
                key={channel.id}
                className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{channel.name}</span>
                    {channel.isDefault && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Default</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingChannelId === channel.id ? (
                      <>
                        <button
                          onClick={() => handleUpdateChannelKeywords(channel.id)}
                          className="text-green-600 hover:text-green-700 p-2 rounded-lg hover:bg-green-50"
                          title="Save"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => { setEditingChannelId(null); setEditingKeywords(''); }}
                          className="text-gray-600 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-200"
                          title="Cancel"
                        >
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEditingChannel(channel)}
                          className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50"
                          title="Edit keywords"
                        >
                          <Edit2 size={18} />
                        </button>
                        {!channel.isDefault && (
                          <button
                            onClick={() => handleDeleteChannel(channel.id)}
                            className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"
                            title="Delete channel"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                
                {editingChannelId === channel.id ? (
                  <input
                    type="text"
                    value={editingKeywords}
                    onChange={(e) => setEditingKeywords(e.target.value)}
                    placeholder="Keywords (comma-separated)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    autoFocus
                    onKeyPress={(e) => e.key === 'Enter' && handleUpdateChannelKeywords(channel.id)}
                  />
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {channel.keywords.length > 0 ? (
                      channel.keywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded"
                        >
                          {keyword}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400 italic">No keywords defined</span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Channel Identification Rules */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Rules</h2>
        <p className="text-sm text-gray-600 mb-6">
          Add quick keyword-to-channel mappings. These are simpler than editing channel keywords above.
        </p>

        {/* Add New Rule */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Keyword or phrase (e.g., 'vim do google')"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && handleAddRule()}
          />
          <select
            value={newChannel}
            onChange={(e) => setNewChannel(e.target.value as LeadChannel)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {channelNames.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
          <button onClick={handleAddRule} className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            Add Rule
          </button>
        </div>

        {/* Rules List */}
        {rules.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No rules defined yet. Add your first rule above.
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div>
                  <span className="font-medium text-gray-900">{rule.keyword}</span>
                  <span className="mx-2 text-gray-400">→</span>
                  <span className="text-blue-600">{rule.channel}</span>
                </div>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reprocess Data */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Reprocess Data</h2>
        <p className="text-sm text-gray-600 mb-4">
          Reprocess all conversations with the current rules and API settings.
          Existing analysis will be overwritten.
        </p>
        <button
          onClick={handleReprocessAll}
          disabled={isReprocessing}
          className="btn-secondary flex items-center gap-2"
        >
          {isReprocessing ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              Reprocessing...
            </>
          ) : (
            <>
              <RefreshCw size={18} />
              Reprocess All Data
            </>
          )}
        </button>
      </div>
    </div>
  );
}
