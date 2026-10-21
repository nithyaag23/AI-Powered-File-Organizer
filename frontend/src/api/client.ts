import { DashboardStats, FileItem, DuplicateGroup, SemanticSearchResult, SystemStatus, CategoryName } from '../types';
import { getActiveSession } from '../utils/session';

export const API_BASE = '/api';

function getAuthHeaders(): Record<string, string> {
  try {
    const session = getActiveSession();
    if (session && session.token) {
      return { Authorization: `Bearer ${session.token}` };
    }
  } catch {}
  return {};
}

export async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(`Failed to load stats: ${res.statusText}`);
  return res.json();
}

export async function uploadFiles(files: File[]): Promise<{ uploaded_count: number; files: FileItem[] }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const res = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}

export async function fetchFiles(options?: {
  category?: string;
  subfolder?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<FileItem[]> {
  const params = new URLSearchParams();
  if (options?.category && options.category !== 'All') {
    params.set('category', options.category);
  }
  if (options?.subfolder) {
    params.set('subfolder', options.subfolder);
  }
  if (options?.search) {
    params.set('search', options.search);
  }
  if (options?.sortBy) {
    params.set('sort_by', options.sortBy);
  }
  if (options?.sortOrder) {
    params.set('sort_order', options.sortOrder);
  }

  const res = await fetch(`${API_BASE}/files?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to list files: ${res.statusText}`);
  return res.json();
}

export async function deleteFile(fileId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/files/${fileId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete file: ${res.statusText}`);
}

export function getDownloadUrl(fileId: string): string {
  return `${API_BASE}/files/${fileId}/download`;
}

export function getOrganizedZipUrl(): string {
  return `${API_BASE}/files/download-organized-zip`;
}

export async function reorganizeFiles(): Promise<{ status: string; reorganized_count: number; files: any[] }> {
  const res = await fetch(`${API_BASE}/files/reorganize`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to reorganize files: ${res.statusText}`);
  return res.json();
}

export async function fetchDuplicates(): Promise<DuplicateGroup[]> {
  const res = await fetch(`${API_BASE}/duplicates`);
  if (!res.ok) throw new Error(`Failed to fetch duplicates: ${res.statusText}`);
  return res.json();
}

export async function cleanupDuplicates(
  keepStrategy: 'keep_first' | 'keep_latest' = 'keep_first',
  specificFileIds?: string[]
): Promise<{ deleted_count: number; freed_bytes: number; deleted_files: string[] }> {
  const res = await fetch(`${API_BASE}/duplicates/cleanup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keep_strategy: keepStrategy,
      specific_file_ids: specificFileIds,
    }),
  });
  if (!res.ok) throw new Error(`Failed to clean up duplicates: ${res.statusText}`);
  return res.json();
}

export async function searchSemantic(
  query: string,
  limit: number = 10
): Promise<{ query: string; results: SemanticSearchResult[]; total: number; method: string }> {
  const res = await fetch(`${API_BASE}/search/semantic?q=${encodeURIComponent(query)}&limit=${limit}`);
  if (!res.ok) throw new Error(`Semantic search failed: ${res.statusText}`);
  return res.json();
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE}/settings/status`);
  if (!res.ok) throw new Error(`Failed to fetch system status: ${res.statusText}`);
  return res.json();
}

export async function clearAllData(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/settings/clear-all`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders()
    }
  });
  if (!res.ok) throw new Error(`Failed to reset data: ${res.statusText}`);
  return res.json();
}

export async function loginUser(
  email: string,
  password: string,
  role: 'admin' | 'user' = 'user'
): Promise<import('../types').LoginChallengeResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Login failed. Please check your credentials.');
  }
  return data;
}

export async function verifyLoginOtp(
  challenge_id: string,
  otp: string
): Promise<import('../types').AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge_id, otp }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Invalid or expired verification code.');
  }
  return data;
}

export async function resendLoginOtp(
  challenge_id: string
): Promise<import('../types').ResendOtpResponse> {
  const res = await fetch(`${API_BASE}/auth/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge_id }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to resend login code.');
  }
  return data;
}

export async function registerUser(
  email: string,
  password: string,
  role: 'admin' | 'user' = 'user'
): Promise<import('../types').RegisterResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Registration failed.');
  }
  return data;
}

export async function verifyEmail(token: string): Promise<import('../types').VerifyEmailResponse> {
  const res = await fetch(`${API_BASE}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Verification failed. Token may be invalid or expired.');
  }
  return data;
}

export async function resendVerification(email: string): Promise<import('../types').ResendVerificationResponse> {
  const res = await fetch(`${API_BASE}/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to resend verification email.');
  }
  return data;
}

export async function processBatchFiles(
  files: File[],
  removeDuplicates: boolean = true
): Promise<import('../types').BatchProcessResult> {
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', f);
  }
  const res = await fetch(`${API_BASE}/files/batch-process?remove_duplicates=${removeDuplicates}`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Batch processing failed.');
  }
  return data;
}

export function getBatchDownloadUrl(sessionId: string): string {
  return `${API_BASE}/files/batch-download/${sessionId}`;
}

