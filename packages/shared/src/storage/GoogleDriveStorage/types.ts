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
 * import type { User } from '@react-native-google-signin/google-signin';
 */
export type IGoogleUserInfo = {
  user: {
    id: string;
    name: string | null;
    email: string;
    photo: string | null;
    familyName: string | null;
    givenName: string | null;
  };
  scopes?: string[];
  idToken: string | null;
  /**
   * Not null only if a valid webClientId and offlineAccess: true was
   * specified in configure().
   */
  serverAuthCode: string | null;
};
