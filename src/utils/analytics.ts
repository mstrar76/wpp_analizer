import type { Chat, DashboardKPIs } from '../types';
import { ProcessingStatus } from '../types';

/**
 * Calculate dashboard KPIs from chats
 */
export function calculateKPIs(chats: Chat[]): DashboardKPIs {
  const completedChats = chats.filter(
    (chat) => chat.status === ProcessingStatus.DONE && chat.analysis
  );

  if (completedChats.length === 0) {
    return {
      totalConversations: 0,
      conversionRate: 0,
      avgQualityScore: 0,
      topDevice: 'N/A',
      estimatedRevenue: 0,
      avgTicket: 0,
    };
  }

  const converted = completedChats.filter((chat) => chat.analysis?.converted).length;
  const conversionRate = (converted / completedChats.length) * 100;

  const totalQuality = completedChats.reduce(
    (sum, chat) => sum + (chat.analysis?.qualityScore || 0),
    0
  );
  const avgQualityScore = totalQuality / completedChats.length;

  const deviceCounts = new Map<string, number>();
  completedChats.forEach((chat) => {
    const device = chat.analysis?.equipmentType || 'Unknown';
    deviceCounts.set(device, (deviceCounts.get(device) || 0) + 1);
  });

  const topDevice =
    Array.from(deviceCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  const revenues = completedChats
    .map((chat) => chat.analysis?.negotiationValue || 0)
    .filter((v) => v > 0);

  const estimatedRevenue = revenues.reduce((sum, val) => sum + val, 0);
  const avgTicket = revenues.length > 0 ? estimatedRevenue / revenues.length : 0;

  return {
    totalConversations: completedChats.length,
    conversionRate,
    avgQualityScore,
    topDevice,
    estimatedRevenue,
    avgTicket,
  };
}

/**
 * Get device breakdown data for pie chart
 */
export function getDeviceBreakdown(chats: Chat[]) {
  const deviceCounts = new Map<string, number>();

  chats
    .filter((chat) => chat.status === ProcessingStatus.DONE && chat.analysis)
    .forEach((chat) => {
      const device = chat.analysis?.equipmentType || 'Unknown';
      deviceCounts.set(device, (deviceCounts.get(device) || 0) + 1);
    });

  return Array.from(deviceCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Get lead source distribution for pie chart
 */
export function getLeadSourceDistribution(chats: Chat[]) {
  const channelCounts = new Map<string, number>();

  chats
    .filter((chat) => chat.status === ProcessingStatus.DONE && chat.analysis)
    .forEach((chat) => {
      const channel = chat.analysis?.channel || 'Unknown';
      channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
    });

  return Array.from(channelCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Get common repairs for bar chart
 */
export function getCommonRepairs(chats: Chat[], selectedDevice?: string) {
  let filteredChats = chats.filter(
    (chat) => chat.status === ProcessingStatus.DONE && chat.analysis
  );

  if (selectedDevice && selectedDevice !== 'all') {
    filteredChats = filteredChats.filter(
      (chat) => chat.analysis?.equipmentType === selectedDevice
    );
  }

  const repairCounts = new Map<string, number>();

  filteredChats.forEach((chat) => {
    const repair = chat.analysis?.repairType || 'Unknown';
    repairCounts.set(repair, (repairCounts.get(repair) || 0) + 1);
  });

  return Array.from(repairCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5); // Top 5
}

/**
 * Get quality score distribution for histogram
 */
export function getQualityDistribution(chats: Chat[]) {
  const scores = chats
    .filter((chat) => chat.status === ProcessingStatus.DONE && chat.analysis)
    .map((chat) => chat.analysis?.qualityScore || 0);

  // Group into ranges: 1-2, 3-4, 5-6, 7-8, 9-10
  const ranges = [
    { name: '1-2', min: 1, max: 2 },
    { name: '3-4', min: 3, max: 4 },
    { name: '5-6', min: 5, max: 6 },
    { name: '7-8', min: 7, max: 8 },
    { name: '9-10', min: 9, max: 10 },
  ];

  return ranges.map((range) => ({
    name: range.name,
    value: scores.filter((score) => score >= range.min && score <= range.max).length,
  }));
}

/**
 * Filter chats by date range
 */
export function filterByDateRange(chats: Chat[], start: Date, end: Date): Chat[] {
  return chats.filter((chat) => {
    if (!chat.timestamp) return false;
    const chatDate = new Date(chat.timestamp);
    return chatDate >= start && chatDate <= end;
  });
}

/**
 * Get date range presets
 */
export function getDateRangePreset(preset: string): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'last7days':
      start.setDate(now.getDate() - 7);
      return { start, end: now };

    case 'thisMonth':
      start.setDate(1);
      return { start, end: now };

    case 'lastMonth':
      start.setMonth(now.getMonth() - 1);
      start.setDate(1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start, end: endOfLastMonth };

    case 'last30days':
      start.setDate(now.getDate() - 30);
      return { start, end: now };

    case 'allTime':
    default:
      return { start: new Date(0), end: now };
  }
}
