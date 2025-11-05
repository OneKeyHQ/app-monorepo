/**
 * Google Drive file representation
 */
export interface IGoogleDriveFile {
  /** Unique file ID in Google Drive */
  id: string;
  /** File name */
  name?: string;
  /** File content (base64 encoded) */
  content: string;
}

/**
 * Google user information
 */
export interface IGoogleUserInfo {
  /** User's email address */
  email: string;
  /** Unique user ID */
  userId: string;
}

/**
 * Native module interface for Google Drive operations
 * Implemented platform-specifically for iOS, Android, Desktop, and Web
 */
export interface IGoogleDriveNativeModule {
  /**
   * Check if Google Drive is available and user is authenticated
   * @returns true if Google Drive is available and ready to use
   */
  isAvailable(): Promise<boolean>;

  /**
   * Sign in to Google account and request Drive API access
   * @returns User information after successful sign-in
   * @throws {OneKeyLocalError} if sign-in fails or is cancelled
   */
  signIn(): Promise<IGoogleUserInfo>;

  /**
   * Sign out from Google account
   */
  signOut(): Promise<void>;

  /**
   * Check if user is currently signed in
   * @returns true if user is signed in
   */
  isSignedIn(): Promise<boolean>;

  /**
   * Get current signed-in user information
   * @returns User info or null if not signed in
   */
  getUserInfo(): Promise<IGoogleUserInfo | null>;

  /**
   * Upload a file to Google Drive
   * @param params.fileName File name to use in Google Drive
   * @param params.content Base64-encoded file content
   * @param params.mimeType MIME type (default: 'application/octet-stream')
   * @param params.folderId Optional parent folder ID (default: root)
   * @returns File ID and creation timestamp
   */
  uploadFile(params: {
    fileName: string;
    content: string;
    mimeType?: string;
    folderId?: string;
  }): Promise<{ fileId: string }>;

  /**
   * Download a file from Google Drive
   * @param params.fileId File ID to download
   * @returns File information with content, or null if not found
   */
  downloadFile(params: { fileId: string }): Promise<IGoogleDriveFile | null>;

  /**
   * Delete a file from Google Drive
   * @param params.fileId File ID to delete
   */
  deleteFile(params: { fileId: string }): Promise<void>;

  /**
   * List files in Google Drive
   * @param params.query Optional Google Drive query string (default: all files)
   * @param params.pageSize Maximum number of files to return (default: 100)
   * @returns List of files matching the query
   */
  listFiles(params: {
    query?: string;
    pageSize?: number;
  }): Promise<{ files: IGoogleDriveFile[] }>;

  /**
   * Check if a file exists in Google Drive
   * @param params.fileId File ID to check
   * @returns true if file exists
   */
  fileExists(params: { fileId: string }): Promise<boolean>;
}

/**
 * Google Drive Storage type alias
 * The storage layer provides a consistent API across all platforms
 */
export type IGoogleDriveStorage = IGoogleDriveNativeModule;
