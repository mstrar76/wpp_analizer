import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Chat, IdentifierRule } from '../types';

// Database Schema
interface ChatInsightDB extends DBSchema {
  chats: {
    key: string;
    value: Chat;
    indexes: {
      'by-timestamp': number;
      'by-status': string;
      'by-channel': string;
    };
  };
  rules: {
    key: string;
    value: IdentifierRule;
  };
}

const DB_NAME = 'chatinsight-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<ChatInsightDB> | null = null;

/**
 * Initialize and get the database instance
 */
export async function getDB(): Promise<IDBPDatabase<ChatInsightDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<ChatInsightDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create chats store
      if (!db.objectStoreNames.contains('chats')) {
        const chatStore = db.createObjectStore('chats', {
          keyPath: 'id',
        });
        chatStore.createIndex('by-timestamp', 'timestamp');
        chatStore.createIndex('by-status', 'status');
        chatStore.createIndex('by-channel', 'analysis.channel');
      }

      // Create rules store
      if (!db.objectStoreNames.contains('rules')) {
        db.createObjectStore('rules', {
          keyPath: 'id',
        });
      }
    },
  });

  return dbInstance;
}

// ========== CHAT OPERATIONS ==========

/**
 * Add a new chat to the database
 */
export async function addChat(chat: Chat): Promise<void> {
  const db = await getDB();
  await db.add('chats', chat);
}

/**
 * Add multiple chats in a batch
 */
export async function addChats(chats: Chat[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('chats', 'readwrite');
  
  await Promise.all([
    ...chats.map((chat) => tx.store.add(chat)),
    tx.done,
  ]);
}

/**
 * Get a chat by ID
 */
export async function getChat(id: string): Promise<Chat | undefined> {
  const db = await getDB();
  return db.get('chats', id);
}

/**
 * Get all chats
 */
export async function getAllChats(): Promise<Chat[]> {
  const db = await getDB();
  return db.getAll('chats');
}

/**
 * Update an existing chat
 */
export async function updateChat(chat: Chat): Promise<void> {
  const db = await getDB();
  await db.put('chats', chat);
}

/**
 * Update multiple chats in a batch
 */
export async function updateChats(chats: Chat[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('chats', 'readwrite');
  
  await Promise.all([
    ...chats.map((chat) => tx.store.put(chat)),
    tx.done,
  ]);
}

/**
 * Delete a chat by ID
 */
export async function deleteChat(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('chats', id);
}

/**
 * Delete all chats
 */
export async function deleteAllChats(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('chats', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

export async function deleteChats(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('chats', 'readwrite');
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

/**
 * Get chats by status
 */
export async function getChatsByStatus(status: string): Promise<Chat[]> {
  const db = await getDB();
  return db.getAllFromIndex('chats', 'by-status', status);
}

/**
 * Count total chats
 */
export async function countChats(): Promise<number> {
  const db = await getDB();
  return db.count('chats');
}

export async function removeDuplicateChats(): Promise<number> {
  const db = await getDB();
  const tx = db.transaction('chats', 'readwrite');
  const store = tx.store;
  const allChats = await store.getAll();
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

  await Promise.all(toDelete.map((id) => store.delete(id)));
  await tx.done;
  return toDelete.length;
}

// ========== RULE OPERATIONS ==========

/**
 * Add a new identification rule
 */
export async function addRule(rule: IdentifierRule): Promise<void> {
  const db = await getDB();
  await db.add('rules', rule);
}

/**
 * Get all identification rules
 */
export async function getAllRules(): Promise<IdentifierRule[]> {
  const db = await getDB();
  return db.getAll('rules');
}

/**
 * Update an existing rule
 */
export async function updateRule(rule: IdentifierRule): Promise<void> {
  const db = await getDB();
  await db.put('rules', rule);
}

/**
 * Delete a rule by ID
 */
export async function deleteRule(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('rules', id);
}

/**
 * Initialize default rules if none exist
 */
export async function initializeDefaultRules(): Promise<void> {
  const existingRules = await getAllRules();
  
  if (existingRules.length === 0) {
    const defaultRules: IdentifierRule[] = [
      {
        id: crypto.randomUUID(),
        keyword: 'vim do google',
        channel: 'Google Ads',
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
    ];

    const db = await getDB();
    const tx = db.transaction('rules', 'readwrite');
    
    await Promise.all([
      ...defaultRules.map((rule) => tx.store.add(rule)),
      tx.done,
    ]);
  }
}

// ========== UTILITY OPERATIONS ==========

/**
 * Clear all data from the database
 */
export async function clearDatabase(): Promise<void> {
  await deleteAllChats();
  const db = await getDB();
  const tx = db.transaction('rules', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

/**
 * Export all data as JSON
 */
export async function exportData(): Promise<{ chats: Chat[]; rules: IdentifierRule[] }> {
  const chats = await getAllChats();
  const rules = await getAllRules();
  return { chats, rules };
}
