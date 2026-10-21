export type CategoryName = 'Documents' | 'Images' | 'Videos' | 'Audio' | 'Archives' | 'Other';

export interface FileItem {
  id: string;
  original_name: string;
  stored_name: string;
  file_path: string;
  file_size: number;
  file_hash: string;
  category: CategoryName;
  extension: string;
  mime_type: string;
  extracted_text?: string;
  subfolder?: string;
  topic?: string;
  clean_name?: string;
  tags?: string[];
  created_at: string;
  is_duplicate?: boolean;
  existing_duplicate_count?: number;
}

export interface DuplicateGroup {
  hash: string;
  count: number;
  file_size: number;
  wasted_size: number;
  files: FileItem[];
}

export interface CategoryStat {
  count: number;
  size: number;
}

export interface SubfolderStat {
  subfolder: string;
  category: string;
  count: number;
  size: number;
}

export interface DashboardStats {
  total_files: number;
  total_size: number;
  duplicate_files_count: number;
  duplicate_wasted_size: number;
  categories: Record<CategoryName, CategoryStat>;
  subfolders?: SubfolderStat[];
  recent_files: FileItem[];
}

export interface SemanticSearchResult extends FileItem {
  similarity_score: number;
  snippet: string;
}

export interface SystemStatus {
  backend: {
    status: string;
    version: string;
    port: number;
    host: string;
  };
  storage: {
    upload_dir: string;
    total_files: number;
    total_size: number;
  };
  ollama: {
    base_url: string;
    connected: boolean;
    models: string[];
    active_model: string;
    model_ready: boolean;
    instructions: string;
  };
  chromadb: {
    initialized: boolean;
    path: string;
    collection_count: number;
  };
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  is_verified?: boolean;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  message: string;
}

export interface LoginChallengeResponse {
  status: 'otp_required';
  challenge_id: string;
  email: string;
  message: string;
  expires_in: number;
}

export interface ResendOtpResponse {
  success: boolean;
  challenge_id: string;
  message: string;
  expires_in: number;
}

export interface RegisterResponse {
  status: string;
  message: string;
  email: string;
  role: string;
  challenge_id?: string;
  expires_in?: number;
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
  email?: string;
}

export interface ResendVerificationResponse {
  success: boolean;
  message: string;
}

export interface BatchFolderFile {
  name: string;
  original_name: string;
  size: number;
  topic?: string;
}

export interface BatchFolder {
  subfolder: string;
  category: string;
  count: number;
  total_size: number;
  files: BatchFolderFile[];
}

export interface BatchDuplicateFile {
  original_name: string;
  duplicate_of: string;
  file_size: number;
  hash: string;
}

export interface BatchProcessResult {
  session_id: string;
  total_files: number;
  unique_files_count: number;
  duplicates_removed_count: number;
  wasted_bytes_saved: number;
  folders: BatchFolder[];
  duplicate_files: BatchDuplicateFile[];
  download_url: string;
}
