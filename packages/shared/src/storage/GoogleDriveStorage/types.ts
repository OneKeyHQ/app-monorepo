import type { User } from '@react-native-google-signin/google-signin';

/**
 * Google Drive file representation
 */
export interface IGoogleDriveFile {
  /** Unique file ID in Google Drive */
  id: string;
  /** File name */
  name?: string;
  /** File content (base64 encoded) */
  content?: string;
}

/**
 * Google user information
 */
export type IGoogleUserInfo = User;
