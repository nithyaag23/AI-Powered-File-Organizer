import { User } from '../types';

// 15 Minutes inactivity timeout period
export const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

const USER_KEY = 'file_organizer_user';
const TOKEN_KEY = 'file_organizer_token';
const ACTIVITY_KEY = 'file_organizer_last_active';

export function saveSession(user: User, token: string): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
  } catch (e) {
    console.error('Failed to save session', e);
  }
}

export function updateSessionActivity(): void {
  try {
    if (localStorage.getItem(USER_KEY)) {
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
    }
  } catch (e) {
    console.error('Failed to update session activity', e);
  }
}

export function getActiveSession(): { user: User; token: string } | null {
  try {
    const userStr = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    const lastActiveStr = localStorage.getItem(ACTIVITY_KEY);

    if (!userStr || !token || !lastActiveStr) {
      clearSession();
      return null;
    }

    const lastActive = parseInt(lastActiveStr, 10);
    const now = Date.now();

    // Check if session has exceeded 15 minutes of inactivity
    if (isNaN(lastActive) || now - lastActive > SESSION_TIMEOUT_MS) {
      clearSession();
      return null;
    }

    // Refresh activity timestamp on successful retrieval
    localStorage.setItem(ACTIVITY_KEY, now.toString());
    const user: User = JSON.parse(userStr);
    return { user, token };
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
  } catch (e) {
    console.error('Failed to clear session', e);
  }
}
