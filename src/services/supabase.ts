import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Database types for WPP Analyzer
export interface DbChat {
  id: string;
  user_id: string;
  file_name: string;
  content: string;
  messages: unknown[];
  timestamp: number | null;
  uploaded_at: number;
  status: string;
  analysis: unknown | null;
  error: string | null;
  processed_at: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbRule {
  id: string;
  user_id: string;
  keyword: string;
  channel: string;
  created_at: number;
}
