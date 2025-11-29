// Default Lead Channel Constants
export const DefaultLeadChannels = [
  'gAds',
  'Facebook',
  'Instagram',
  'Outros',
  'Orgânico',
  'Indicação',
  'Cliente_Existente',
] as const;

// LeadChannel can be any string (custom channels supported)
export type LeadChannel = string;

export const ProcessingStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  DONE: 'done',
  FAILED: 'failed',
} as const;

export type ProcessingStatus = typeof ProcessingStatus[keyof typeof ProcessingStatus];

// Chat Message
export interface ChatMessage {
  date: Date;
  sender: string;
  content: string;
}

// Raw Chat File
export interface RawChatFile {
  id: string;
  fileName: string;
  content: string;
  messages: ChatMessage[];
  timestamp?: number; // Parsed from first message
  uploadedAt: number;
}

// Analysis Result
export interface AnalysisResult {
  channel: LeadChannel;
  equipmentType: string;
  equipmentLine: string;
  repairType: string;
  negotiationValue?: number;
  converted: boolean;
  attendantName: string;
  qualityScore: number;
  qualityReason: string;
  summary: string;
}

// Identifier Rule for Channel Attribution
export interface IdentifierRule {
  id: string;
  keyword: string;
  channel: LeadChannel;
  createdAt: number;
}

// Chat with Analysis (Combined)
export interface Chat extends RawChatFile {
  status: ProcessingStatus;
  analysis?: AnalysisResult;
  error?: string;
  processedAt?: number;
}

// Filter Options
export interface FilterOptions {
  searchQuery?: string;
  status?: 'all' | 'converted' | 'highQuality';
  channel?: LeadChannel | 'all';
  device?: string | 'all';
  repair?: string | 'all';
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Date Range Presets
export const DateRangePreset = {
  LAST_7_DAYS: 'last7days',
  THIS_MONTH: 'thisMonth',
  LAST_MONTH: 'lastMonth',
  LAST_30_DAYS: 'last30days',
  ALL_TIME: 'allTime',
  CUSTOM: 'custom',
} as const;

export type DateRangePreset = typeof DateRangePreset[keyof typeof DateRangePreset];

// Dashboard KPIs
export interface DashboardKPIs {
  totalConversations: number;
  conversionRate: number;
  avgQualityScore: number;
  topDevice: string;
  estimatedRevenue: number;
  avgTicket: number;
}

// Chart Data Types
export interface PieChartData {
  name: string;
  value: number;
  color?: string;
}

export interface BarChartData {
  name: string;
  value: number;
}
