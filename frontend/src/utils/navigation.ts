import { PageId } from '../components/Sidebar';
export type { PageId };

export interface NavigationLocation {
  view: 'landing' | 'workspace';
  page: PageId;
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
  const cleanHash = hash.replace(/^#\/?/, '').trim().toLowerCase();
  
  if (!cleanHash || cleanHash === 'landing') {
    return { view: 'landing', page: 'batch-organizer' };
  }

  if (VALID_PAGES.includes(cleanHash as PageId)) {
    return { view: 'workspace', page: cleanHash as PageId };
  }

  // Default fallback
  return { view: 'landing', page: 'batch-organizer' };
}

export function buildHash(view: 'landing' | 'workspace', page: PageId): string {
  if (view === 'landing') {
    return '#/landing';
  }
  return `#/${page}`;
}
