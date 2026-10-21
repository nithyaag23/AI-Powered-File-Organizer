import { PageId } from '../components/Sidebar';
export type { PageId };

export interface NavigationLocation {
  view: 'landing' | 'workspace' | 'verify-email';
  page: PageId;
  token?: string;
}

export const VALID_PAGES: PageId[] = [
  'batch-organizer',
  'dashboard',
  'upload',
  'all-files',
  'duplicates',
  'categories',
  'ai-search',
  'settings'
];

export const PAGE_TITLES: Record<string, string> = {
  'landing': 'Landing Page',
  'verify-email': 'Verify Email',
  'batch-organizer': 'Batch Organizer',
  'dashboard': 'Dashboard',
  'upload': 'Upload Files',
  'all-files': 'All Files',
  'duplicates': 'Duplicates',
  'categories': 'Categories',
  'ai-search': 'AI Search',
  'settings': 'Settings',
};

export function parseLocationFromHash(hash: string): NavigationLocation {
  const rawHash = hash.replace(/^#\/?/, '').trim();
  const pathPart = rawHash.split('?')[0].toLowerCase().replace(/^\/+/, '');

  // Check email verification route
  if (pathPart.startsWith('verify-email')) {
    let token = '';
    // Look for ?token=... in the hash
    if (rawHash.includes('token=')) {
      const match = rawHash.match(/token=([^&]+)/);
      if (match) token = decodeURIComponent(match[1]);
    } else if (pathPart.includes('/')) {
      // Look for #/verify-email/<token>
      const parts = rawHash.split('/');
      if (parts.length > 1) token = parts[1];
    }

    // Also check window.location.search if token was provided in regular query string
    if (!token && typeof window !== 'undefined' && window.location.search.includes('token=')) {
      const urlParams = new URLSearchParams(window.location.search);
      token = urlParams.get('token') || '';
    }

    return { view: 'verify-email', page: 'batch-organizer', token };
  }

  if (!pathPart || pathPart === 'landing') {
    return { view: 'landing', page: 'batch-organizer' };
  }

  if (VALID_PAGES.includes(pathPart as PageId)) {
    return { view: 'workspace', page: pathPart as PageId };
  }

  // Default fallback
  return { view: 'landing', page: 'batch-organizer' };
}

export function buildHash(view: 'landing' | 'workspace' | 'verify-email', page: PageId, token?: string): string {
  if (view === 'verify-email') {
    return token ? `#/verify-email?token=${encodeURIComponent(token)}` : '#/verify-email';
  }
  if (view === 'landing') {
    return '#/landing';
  }
  return `#/${page}`;
}
