import { useState, useMemo } from 'react';
import { Search, Download, X, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';
import { FixedSizeList as List } from 'react-window';
import { useChats } from '../hooks/useChats';
import { ProcessingStatus } from '../types';
import type { Chat } from '../types';
import { formatToWhatsAppExport } from '../utils/whatsappParser';

export default function Chats() {
  const { chats, loading } = useChats();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [repairFilter, setRepairFilter] = useState('all');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  // Get unique values for filters
  const channels = useMemo(() => {
    const unique = new Set(
      chats
        .filter((c) => c.analysis?.channel)
        .map((c) => c.analysis!.channel)
    );
    return Array.from(unique).sort();
  }, [chats]);

  const devices = useMemo(() => {
    const unique = new Set(
      chats
        .filter((c) => c.analysis?.equipmentType)
        .map((c) => c.analysis!.equipmentType)
    );
    return Array.from(unique).sort();
  }, [chats]);

  const repairs = useMemo(() => {
    const unique = new Set(
      chats
        .filter((c) => c.analysis?.repairType)
        .map((c) => c.analysis!.repairType)
    );
    return Array.from(unique).sort();
  }, [chats]);

  // Filter chats
  const filteredChats = useMemo(() => {
    return chats.filter((chat) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches =
          chat.fileName.toLowerCase().includes(query) ||
          chat.analysis?.attendantName?.toLowerCase().includes(query) ||
          chat.analysis?.equipmentType?.toLowerCase().includes(query);
        if (!matches) return false;
      }

      // Status filter
      if (statusFilter === 'converted' && !chat.analysis?.converted) return false;
      if (statusFilter === 'highQuality' && (chat.analysis?.qualityScore || 0) <= 8) return false;

      // Channel filter
      if (channelFilter !== 'all' && chat.analysis?.channel !== channelFilter) return false;

      // Device filter
      if (deviceFilter !== 'all' && chat.analysis?.equipmentType !== deviceFilter) return false;

      // Repair filter
      if (repairFilter !== 'all' && chat.analysis?.repairType !== repairFilter) return false;

      return true;
    });
  }, [chats, searchQuery, statusFilter, channelFilter, deviceFilter, repairFilter]);

  function exportToJSONL() {
    const data = filteredChats
      .filter((chat) => chat.status === ProcessingStatus.DONE && chat.analysis)
      .map((chat) => ({
        input: formatToWhatsAppExport(chat.messages),
        output: JSON.stringify(chat.analysis),
      }));

    const jsonl = data.map((item) => JSON.stringify(item)).join('\n');
    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatinsight-export-${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case ProcessingStatus.DONE:
        return <CheckCircle className="text-green-600" size={18} />;
      case ProcessingStatus.PROCESSING:
        return <Clock className="text-blue-600" size={18} />;
      case ProcessingStatus.FAILED:
        return <XCircle className="text-red-600" size={18} />;
      default:
        return <AlertCircle className="text-gray-400" size={18} />;
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analyzed Chats</h1>
          <p className="text-gray-600 mt-1">
            {filteredChats.length} of {chats.length} chats
          </p>
        </div>
        <button onClick={exportToJSONL} className="btn-primary flex items-center gap-2">
          <Download size={18} />
          Export JSONL
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by file name, attendant, or device..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="converted">Converted Only</option>
            <option value="highQuality">High Quality (&gt;8)</option>
          </select>

          {/* Channel Filter */}
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Channels</option>
            {channels.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>

          {/* Device Filter */}
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Devices</option>
            {devices.map((device) => (
              <option key={device} value={device}>
                {device}
              </option>
            ))}
          </select>

          {/* Repair Filter */}
          <select
            value={repairFilter}
            onChange={(e) => setRepairFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Repairs</option>
            {repairs.map((repair) => (
              <option key={repair} value={repair}>
                {repair}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chat List */}
      <div className="card overflow-hidden">
        {/* Table Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 grid grid-cols-7 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div>Status</div>
          <div>File Name</div>
          <div>Date</div>
          <div>Equipment / Repair</div>
          <div>Value</div>
          <div>Channel</div>
          <div>Score</div>
        </div>

        {/* Virtualized List */}
        {filteredChats.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">No chats found</div>
        ) : (
          <List
            height={600}
            itemCount={filteredChats.length}
            itemSize={80}
            width="100%"
          >
            {({ index, style }: { index: number; style: React.CSSProperties }) => {
              const chat = filteredChats[index];
              return (
                <div
                  style={style}
                  onClick={() => setSelectedChat(chat)}
                  className="px-6 grid grid-cols-7 gap-4 items-center hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100"
                >
                  <div>{getStatusIcon(chat.status)}</div>
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {chat.fileName}
                  </div>
                  <div className="text-sm text-gray-500">
                    {chat.timestamp ? new Date(chat.timestamp).toLocaleDateString() : 'N/A'}
                  </div>
                  <div>
                    {chat.analysis ? (
                      <div className="text-sm">
                        <div className="font-medium text-gray-900 truncate">
                          {chat.analysis.equipmentLine || chat.analysis.equipmentType}
                        </div>
                        <div className="text-gray-500 text-xs">{chat.analysis.repairType}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-900">
                    {chat.analysis?.negotiationValue
                      ? `R$ ${chat.analysis.negotiationValue.toFixed(2)}`
                      : '-'}
                  </div>
                  <div>
                    {chat.analysis?.channel ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {chat.analysis.channel}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    {chat.analysis?.qualityScore ? (
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          chat.analysis.qualityScore >= 8
                            ? 'bg-green-100 text-green-800'
                            : chat.analysis.qualityScore >= 5
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {chat.analysis.qualityScore}/10
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </div>
              );
            }}
          </List>
        )}
      </div>

      {/* Chat Detail Slide-over */}
      {selectedChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setSelectedChat(null)}>
          <div
            className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 truncate">
                {selectedChat.fileName}
              </h2>
              <button
                onClick={() => setSelectedChat(null)}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {/* AI Insights Card */}
              {selectedChat.analysis && (
                <div className="card mb-6 bg-blue-50">
                  <h3 className="font-semibold text-gray-900 mb-4">AI Analysis</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Channel:</span>
                      <span className="ml-2 font-medium">{selectedChat.analysis.channel}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Device:</span>
                      <span className="ml-2 font-medium">{selectedChat.analysis.equipmentType}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Model:</span>
                      <span className="ml-2 font-medium">{selectedChat.analysis.equipmentLine}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Repair:</span>
                      <span className="ml-2 font-medium">{selectedChat.analysis.repairType}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Value:</span>
                      <span className="ml-2 font-medium">
                        {selectedChat.analysis.negotiationValue
                          ? `R$ ${selectedChat.analysis.negotiationValue.toFixed(2)}`
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Converted:</span>
                      <span className="ml-2 font-medium">
                        {selectedChat.analysis.converted ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600">Quality Score:</span>
                      <span className="ml-2 font-medium">
                        {selectedChat.analysis.qualityScore}/10
                      </span>
                      <span className="ml-2 text-gray-500 text-xs">
                        ({selectedChat.analysis.qualityReason})
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600">Summary:</span>
                      <p className="mt-1 text-gray-900">{selectedChat.analysis.summary}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Messages */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 mb-4">Conversation</h3>
                {selectedChat.messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg p-3 ${
                      msg.sender.toLowerCase().includes('system') ||
                      msg.sender.toLowerCase().includes('service')
                        ? 'bg-gray-100'
                        : 'bg-blue-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm text-gray-900">{msg.sender}</span>
                      <span className="text-xs text-gray-500">
                        {msg.date.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
