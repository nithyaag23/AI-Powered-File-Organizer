import { DashboardStats, FileItem, DuplicateGroup, SemanticSearchResult, SystemStatus, CategoryName } from '../types';

export const API_BASE = '/api';

/** fetch() for API calls. The session cookie is sent automatically (same-origin). */
export function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const auth = getAuthHeaders();
  if (auth.Authorization) headers.set('Authorization', auth.Authorization);
  return fetch(input, { credentials: 'same-origin', ...init, headers });
}

/** Download a protected file: fetch with the token, then save it locally. */
export async function downloadFromApi(path: string, fallbackName = 'download'): Promise<void> {
  const res = await authFetch(path);
  if (!res.ok) {
    // Prefer the server's explanation (e.g. "No files available to organize and download.")
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body && typeof body.detail === 'string') detail = body.detail;
    } catch {}
    throw new Error(detail || 'Download failed.');
  }
  const blob = await res.blob();
  let name = fallbackName;
  const match = (res.headers.get('Content-Disposition') || '').match(/filename="?([^";]+)"?/i);
  if (match) {
    try { name = decodeURIComponent(match[1]); } catch { name = match[1]; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** onClick handler for download links: uses the authenticated download instead of a plain navigation. */
export function handleApiDownload(e: { preventDefault(): void; currentTarget: HTMLAnchorElement }): void {
  e.preventDefault();
  const path = e.currentTarget.getAttribute('href') || '';
  downloadFromApi(path).catch((err) => alert(err instanceof Error ? err.message : 'Download failed.'));
}


// Session auth is carried by the httpOnly cookie, so no header is needed.
function getAuthHeaders(): Record<string, string> {
  return {};
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchStats(): Promise<DashboardStats> {
  const res = await authFetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(`Failed to load stats: ${res.statusText}`);
  return res.json();
}

export async function uploadFiles(files: File[]): Promise<{ uploaded_count: number; files: FileItem[] }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const res = await authFetch(`${API_BASE}/files/upload`, {
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

  const res = await authFetch(`${API_BASE}/files?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to list files: ${res.statusText}`);
  return res.json();
}

export async function deleteFile(fileId: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/files/${fileId}`, {
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
  const res = await authFetch(`${API_BASE}/files/reorganize`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to reorganize files: ${res.statusText}`);
  return res.json();
}

export async function fetchDuplicates(): Promise<DuplicateGroup[]> {
  const res = await authFetch(`${API_BASE}/duplicates`);
  if (!res.ok) throw new Error(`Failed to fetch duplicates: ${res.statusText}`);
  return res.json();
}

export async function cleanupDuplicates(
  keepStrategy: 'keep_first' | 'keep_latest' = 'keep_first',
  specificFileIds?: string[]
): Promise<{ deleted_count: number; freed_bytes: number; deleted_files: string[] }> {
  const res = await authFetch(`${API_BASE}/duplicates/cleanup`, {
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
  const res = await authFetch(`${API_BASE}/search/semantic?q=${encodeURIComponent(query)}&limit=${limit}`);
  if (!res.ok) throw new Error(`Semantic search failed: ${res.statusText}`);
  return res.json();
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await authFetch(`${API_BASE}/settings/status`);
  if (!res.ok) throw new Error(`Failed to fetch system status: ${res.statusText}`);
  return res.json();
}

export async function clearAllData(): Promise<{ status: string; message: string }> {
  const res = await authFetch(`${API_BASE}/settings/clear-all`, {
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
  const res = await authFetch(`${API_BASE}/auth/login`, {
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
  const res = await authFetch(`${API_BASE}/auth/verify-otp`, {
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
  const res = await authFetch(`${API_BASE}/auth/resend-otp`, {
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
  const res = await authFetch(`${API_BASE}/auth/register`, {
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
  const res = await authFetch(`${API_BASE}/auth/verify-email`, {
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
  const res = await authFetch(`${API_BASE}/auth/resend-verification`, {
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
  const res = await authFetch(`${API_BASE}/files/batch-process?remove_duplicates=${removeDuplicates}`, {
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

