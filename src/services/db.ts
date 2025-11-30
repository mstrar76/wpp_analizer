import { supabase, type DbChat, type DbRule } from './supabase';
import type { Chat, IdentifierRule, ChatMessage, AnalysisResult, ProcessingStatus } from '../types';

/**
 * Get the current authenticated user ID
 */
async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.id;
}

/**
 * Convert database chat to frontend Chat type
 */
function dbChatToChat(dbChat: DbChat): Chat {
  return {
    id: dbChat.id,
    fileName: dbChat.file_name,
    content: dbChat.content,
    messages: (dbChat.messages as ChatMessage[]) || [],
    timestamp: dbChat.timestamp ?? undefined,
    uploadedAt: dbChat.uploaded_at,
    status: dbChat.status as ProcessingStatus,
    analysis: dbChat.analysis as AnalysisResult | undefined,
    error: dbChat.error ?? undefined,
    processedAt: dbChat.processed_at ?? undefined,
  };
}

/**
 * Convert frontend Chat to database format
 */
function chatToDbChat(chat: Chat, userId: string): Omit<DbChat, 'created_at' | 'updated_at'> {
  return {
    id: chat.id,
    user_id: userId,
    file_name: chat.fileName,
    content: chat.content,
    messages: chat.messages as unknown[],
    timestamp: chat.timestamp ?? null,
    uploaded_at: chat.uploadedAt,
    status: chat.status,
    analysis: chat.analysis ?? null,
    error: chat.error ?? null,
    processed_at: chat.processedAt ?? null,
  };
}

/**
 * Convert database rule to frontend IdentifierRule type
 */
function dbRuleToRule(dbRule: DbRule): IdentifierRule {
  return {
    id: dbRule.id,
    keyword: dbRule.keyword,
    channel: dbRule.channel,
    createdAt: dbRule.created_at,
  };
}

/**
 * Convert frontend IdentifierRule to database format
 */
function ruleToDbRule(rule: IdentifierRule, userId: string): DbRule {
  return {
    id: rule.id,
    user_id: userId,
    keyword: rule.keyword,
    channel: rule.channel,
    created_at: rule.createdAt,
  };
}

// ========== CHAT OPERATIONS ==========

/**
 * Add a new chat to the database
 */
export async function addChat(chat: Chat): Promise<void> {
  const userId = await getUserId();
  const dbChat = chatToDbChat(chat, userId);
  
  const { error } = await supabase
    .from('wpp_chats')
    .insert(dbChat);
  
  if (error) throw new Error(`Failed to add chat: ${error.message}`);
}

/**
 * Add multiple chats in a batch
 */
export async function addChats(chats: Chat[]): Promise<void> {
  const userId = await getUserId();
  const dbChats = chats.map(chat => chatToDbChat(chat, userId));
  
  const { error } = await supabase
    .from('wpp_chats')
    .insert(dbChats);
  
  if (error) throw new Error(`Failed to add chats: ${error.message}`);
}

/**
 * Get a chat by ID
 */
export async function getChat(id: string): Promise<Chat | undefined> {
  const { data, error } = await supabase
    .from('wpp_chats')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return undefined; // Not found
    throw new Error(`Failed to get chat: ${error.message}`);
  }
  
  return data ? dbChatToChat(data as DbChat) : undefined;
}

/**
 * Get all chats
 */
export async function getAllChats(): Promise<Chat[]> {
  const { data, error } = await supabase
    .from('wpp_chats')
    .select('*')
    .order('uploaded_at', { ascending: false });
  
  if (error) throw new Error(`Failed to get chats: ${error.message}`);
  
  return (data || []).map(row => dbChatToChat(row as DbChat));
}

/**
 * Update an existing chat (upsert to avoid conflicts)
 */
export async function updateChat(chat: Chat): Promise<void> {
  const userId = await getUserId();
  const dbChat = chatToDbChat(chat, userId);
  
  const { error } = await supabase
    .from('wpp_chats')
    .upsert(dbChat, { onConflict: 'id' });
  
  if (error) throw new Error(`Failed to update chat: ${error.message}`);
}

/**
 * Update multiple chats in a batch
 */
export async function updateChats(chats: Chat[]): Promise<void> {
  const userId = await getUserId();
  const dbChats = chats.map(chat => chatToDbChat(chat, userId));
  
  const { error } = await supabase
    .from('wpp_chats')
    .upsert(dbChats, { onConflict: 'id' });
  
  if (error) throw new Error(`Failed to update chats: ${error.message}`);
}

/**
 * Delete a chat by ID
 */
export async function deleteChat(id: string): Promise<void> {
  const { error } = await supabase
    .from('wpp_chats')
    .delete()
    .eq('id', id);
  
  if (error) throw new Error(`Failed to delete chat: ${error.message}`);
}

/**
 * Delete all chats for current user
 */
export async function deleteAllChats(): Promise<void> {
  const userId = await getUserId();
  
  const { error } = await supabase
    .from('wpp_chats')
    .delete()
    .eq('user_id', userId);
  
  if (error) throw new Error(`Failed to delete all chats: ${error.message}`);
}

export async function deleteChats(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  
  const { error } = await supabase
    .from('wpp_chats')
    .delete()
    .in('id', ids);
  
  if (error) throw new Error(`Failed to delete chats: ${error.message}`);
}

/**
 * Get chats by status
 */
export async function getChatsByStatus(status: string): Promise<Chat[]> {
  const { data, error } = await supabase
    .from('wpp_chats')
    .select('*')
    .eq('status', status)
    .order('uploaded_at', { ascending: false });
  
  if (error) throw new Error(`Failed to get chats by status: ${error.message}`);
  
  return (data || []).map(row => dbChatToChat(row as DbChat));
}

/**
 * Count total chats
 */
export async function countChats(): Promise<number> {
  const { count, error } = await supabase
    .from('wpp_chats')
    .select('*', { count: 'exact', head: true });
  
  if (error) throw new Error(`Failed to count chats: ${error.message}`);
  
  return count || 0;
}

/**
 * Delete all chats that are not processed (status != DONE)
 */
export async function deleteUnprocessedChats(): Promise<number> {
  // First count how many will be deleted
  const { count } = await supabase
    .from('wpp_chats')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'done');
  
  const { error } = await supabase
    .from('wpp_chats')
    .delete()
    .neq('status', 'done');
  
  if (error) throw new Error(`Failed to delete unprocessed chats: ${error.message}`);
  
  return count || 0;
}

export async function removeDuplicateChats(): Promise<number> {
  // Get all chats ordered by upload time
  const allChats = await getAllChats();
  const seen = new Map<string, Chat>();
  const toDelete: string[] = [];

  for (const chat of allChats) {
    const key = chat.fileName?.trim();
    if (!key) continue;

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, chat);
      continue;
    }

    const existingUploaded = existing.uploadedAt ?? 0;
    const currentUploaded = chat.uploadedAt ?? 0;

    if (currentUploaded >= existingUploaded) {
      toDelete.push(chat.id);
    } else {
      toDelete.push(existing.id);
      seen.set(key, chat);
    }
  }

  if (toDelete.length > 0) {
    await deleteChats(toDelete);
  }
  
  return toDelete.length;
}

// ========== RULE OPERATIONS ==========

/**
 * Add a new identification rule
 */
export async function addRule(rule: IdentifierRule): Promise<void> {
  const userId = await getUserId();
  const dbRule = ruleToDbRule(rule, userId);
  
  const { error } = await supabase
    .from('wpp_rules')
    .insert(dbRule);
  
  if (error) throw new Error(`Failed to add rule: ${error.message}`);
}

/**
 * Get all identification rules
 */
export async function getAllRules(): Promise<IdentifierRule[]> {
  const { data, error } = await supabase
    .from('wpp_rules')
    .select('*')
    .order('created_at', { ascending: true });
  
  if (error) throw new Error(`Failed to get rules: ${error.message}`);
  
  return (data || []).map(row => dbRuleToRule(row as DbRule));
}

/**
 * Update an existing rule
 */
export async function updateRule(rule: IdentifierRule): Promise<void> {
  const userId = await getUserId();
  const dbRule = ruleToDbRule(rule, userId);
  
  const { error } = await supabase
    .from('wpp_rules')
    .upsert(dbRule, { onConflict: 'id' });
  
  if (error) throw new Error(`Failed to update rule: ${error.message}`);
}

/**
 * Delete a rule by ID
 */
export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase
    .from('wpp_rules')
    .delete()
    .eq('id', id);
  
  if (error) throw new Error(`Failed to delete rule: ${error.message}`);
}

/**
 * Initialize default rules if none exist
 */
export async function initializeDefaultRules(): Promise<void> {
  try {
    const existingRules = await getAllRules();
    
    if (existingRules.length === 0) {
      const userId = await getUserId();
      const defaultRules: IdentifierRule[] = [
        {
          id: crypto.randomUUID(),
          keyword: 'vim do google',
          channel: 'gAds',
          createdAt: Date.now(),
        },
        {
          id: crypto.randomUUID(),
          keyword: 'vim do instagram',
          channel: 'Instagram',
          createdAt: Date.now(),
        },
        {
          id: crypto.randomUUID(),
          keyword: 'vim do facebook',
          channel: 'Facebook',
          createdAt: Date.now(),
        },
        {
          id: crypto.randomUUID(),
          keyword: 'cliente',
          channel: 'Cliente_Existente',
          createdAt: Date.now(),
        },
        {
          id: crypto.randomUUID(),
          keyword: 'indicação',
          channel: 'Indicação',
          createdAt: Date.now(),
        },
        {
          id: crypto.randomUUID(),
          keyword: 'indicou',
          channel: 'Indicação',
          createdAt: Date.now(),
        },
      ];

      const dbRules = defaultRules.map(rule => ruleToDbRule(rule, userId));
      
      const { error } = await supabase
        .from('wpp_rules')
        .insert(dbRules);
      
      if (error) throw new Error(`Failed to insert default rules: ${error.message}`);
    }
  } catch (err) {
    // User might not be authenticated yet, silently fail
    console.warn('Could not initialize default rules:', err);
  }
}

// ========== UTILITY OPERATIONS ==========

/**
 * Clear all data from the database (for current user)
 */
export async function clearDatabase(): Promise<void> {
  const userId = await getUserId();
  
  // Delete all chats
  await deleteAllChats();
  
  // Delete all rules
  const { error } = await supabase
    .from('wpp_rules')
    .delete()
    .eq('user_id', userId);
  
  if (error) throw new Error(`Failed to clear rules: ${error.message}`);
}

/**
 * Export all data as JSON
 */
export async function exportData(): Promise<{ chats: Chat[]; rules: IdentifierRule[] }> {
  const chats = await getAllChats();
  const rules = await getAllRules();
  return { chats, rules };
}
