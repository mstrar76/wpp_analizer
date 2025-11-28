import { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, Star, Smartphone, Users, Target } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useChats } from '../hooks/useChats';
import { calculateKPIs, getDeviceBreakdown, getLeadSourceDistribution, getCommonRepairs, getQualityDistribution, filterByDateRange, getDateRangePreset } from '../utils/analytics';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export default function Dashboard() {
  const { chats, loading } = useChats();
  const [datePreset, setDatePreset] = useState('allTime');

  const filteredChats = useMemo(() => {
    if (datePreset === 'allTime') return chats;
    const range = getDateRangePreset(datePreset);
    return filterByDateRange(chats, range.start, range.end);
  }, [chats, datePreset]);

  const kpis = useMemo(() => calculateKPIs(filteredChats), [filteredChats]);
  const deviceData = useMemo(() => getDeviceBreakdown(filteredChats), [filteredChats]);
  const leadData = useMemo(() => getLeadSourceDistribution(filteredChats), [filteredChats]);
  const repairData = useMemo(() => getCommonRepairs(filteredChats), [filteredChats]);
  const qualityData = useMemo(() => getQualityDistribution(filteredChats), [filteredChats]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Analytics overview of your WhatsApp conversations</p>
        </div>
        
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="last7days">Last 7 Days</option>
          <option value="thisMonth">This Month</option>
          <option value="lastMonth">Last Month</option>
          <option value="last30days">Last 30 Days</option>
          <option value="allTime">All Time</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Conversations</h3>
            <Users className="text-blue-600" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-900">{kpis.totalConversations}</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Conversion Rate</h3>
            <Target className="text-green-600" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-900">{kpis.conversionRate.toFixed(1)}%</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Avg. Quality Score</h3>
            <Star className="text-yellow-600" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-900">{kpis.avgQualityScore.toFixed(1)}/10</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Top Device</h3>
            <Smartphone className="text-purple-600" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-900">{kpis.topDevice}</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Est. Revenue</h3>
            <DollarSign className="text-green-600" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            R$ {kpis.estimatedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Avg. Ticket</h3>
            <TrendingUp className="text-blue-600" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            R$ {kpis.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Device Breakdown */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Breakdown</h3>
          {deviceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={deviceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {deviceData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-12">No data available</p>
          )}
        </div>

        {/* Lead Source Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Source Distribution</h3>
          {leadData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={leadData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {leadData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-12">No data available</p>
          )}
        </div>
      </div>

      {/* Bottom Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Common Repairs */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Common Repairs</h3>
          {repairData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={repairData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-12">No data available</p>
          )}
        </div>

        {/* Quality Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Score Distribution</h3>
          {qualityData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={qualityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#10B981" name="Chats" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-12">No data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
