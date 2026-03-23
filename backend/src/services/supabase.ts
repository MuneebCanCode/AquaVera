/**
 * Backward-compatible re-export.
 * All services import getSupabase from here — now backed by in-memory store.
 */
export { getSupabase, getDB, getTable, getPasswordStore, getTokenStore } from './store';
export type { InMemoryDB } from './store';
