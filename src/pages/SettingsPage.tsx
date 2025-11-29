import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, RefreshCw, Save, Eye, EyeOff, X } from 'lucide-react';
import type { IdentifierRule, LeadChannel } from '../types';
import { getAllRules, addRule, deleteRule } from '../services/db';
import { getApiKey, saveApiKey, testApiKey } from '../services/gemini';
import { reprocessAllChats } from '../services/processingQueue';

// Default channels
const DEFAULT_CHANNELS = ['gAds', 'Facebook', 'Instagram', 'Outros', 'Orgânico', 'Indicação', 'Cliente_Existente'];

// Local storage key for custom channels
const CUSTOM_CHANNELS_KEY = 'chatinsight-custom-channels';

function getStoredChannels(): string[] {
  try {
    const stored = localStorage.getItem(CUSTOM_CHANNELS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveStoredChannels(channels: string[]): void {
  localStorage.setItem(CUSTOM_CHANNELS_KEY, JSON.stringify(channels));
}

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<'success' | 'error' | null>(null);
  const [rules, setRules] = useState<IdentifierRule[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newChannel, setNewChannel] = useState<LeadChannel>('gAds');
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [customChannels, setCustomChannels] = useState<string[]>([]);
  const [newChannelName, setNewChannelName] = useState('');

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

    // Load custom channels from localStorage
    const stored = getStoredChannels();
    setCustomChannels(stored);
  }

  // All available channels (default + custom)
  const allChannels = [...DEFAULT_CHANNELS, ...customChannels];

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

  function handleAddChannel() {
    const name = newChannelName.trim();
    if (!name) {
      alert('Please enter a channel name');
      return;
    }

    if (allChannels.some(c => c.toLowerCase() === name.toLowerCase())) {
      alert('This channel already exists');
      return;
    }

    const updated = [...customChannels, name];
    setCustomChannels(updated);
    saveStoredChannels(updated);
    setNewChannelName('');
  }

  function handleRemoveChannel(channelName: string) {
    if (DEFAULT_CHANNELS.includes(channelName)) {
      alert('Cannot remove default channels');
      return;
    }

    const updated = customChannels.filter(c => c !== channelName);
    setCustomChannels(updated);
    saveStoredChannels(updated);
  }

  async function handleReprocessAll() {
    if (!confirm('This will reprocess ALL chats with the current rules. Continue?')) {
      return;
    }

    setIsReprocessing(true);
    try {
      await reprocessAllChats(rules);
      alert('Reprocessing started! Check the Dashboard for progress.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error: ${message}`);
    } finally {
      setIsReprocessing(false);
    }
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

      {/* Channel Identification Rules */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Channel Identification Rules</h2>
        <p className="text-sm text-gray-600 mb-6">
          Define keywords that will automatically assign specific channels to conversations.
          These rules take priority over AI inference.
        </p>

        {/* Available Channels */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Available Channels:</h3>
          <div className="flex flex-wrap gap-2">
            {allChannels.map((channel) => (
              <span
                key={channel}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {channel}
                {!DEFAULT_CHANNELS.includes(channel) && (
                  <button
                    onClick={() => handleRemoveChannel(channel)}
                    className="ml-1 text-blue-600 hover:text-red-600"
                    title="Remove channel"
                  >
                    <X size={14} />
                  </button>
                )}
              </span>
            ))}
          </div>
          
          {/* Add New Channel */}
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="New channel name..."
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleAddChannel()}
            />
            <button
              onClick={handleAddChannel}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-1"
            >
              <Plus size={14} />
              Add Channel
            </button>
          </div>
        </div>

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
            {allChannels.map((channel) => (
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
