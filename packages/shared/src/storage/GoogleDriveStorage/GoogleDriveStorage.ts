import { GoogleSignin } from '@react-native-google-signin/google-signin';
// https://github.com/npomfret/react-native-cloud-fs
// https://github.com/OneKeyHQ/react-native-cloud-fs
import RNCloudFs from 'react-native-cloud-fs';

import googlePlayService from '@onekeyhq/shared/src/googlePlayService/googlePlayService';

import { OneKeyLocalError } from '../../errors';
import RNFS from '../../modules3rdParty/react-native-fs';
import platformEnv from '../../platformEnv';

import type {
  IGoogleDriveFile,
  IGoogleDriveStorage,
  IGoogleUserInfo,
} from './types';

// packages/shared/src/cloudfs/index.android.ts

/**
 * Google Drive Storage implementation using react-native-cloud-fs
 *
 * Platform Support:
 * - iOS: ❌ Not supported (use iCloud instead)
 * - Android: ✅ Uses @onekeyfe/react-native-cloud-fs + @react-native-google-signin/google-signin
 * - Desktop: 🚧 Not yet implemented
 * - Web/Extension: 🚧 Not yet implemented
 *
 * Features:
 * - User authentication via Google Sign-In
 * - File upload/download with base64 encoding
 * - Hidden app data scope (not visible in user's Drive UI)
 * - Automatic temporary file management
 * - Cross-device synchronization via Google account
 *
 * Implementation Details:
 * - Uses temporary files for base64 ↔ Google Drive conversion
 * - Files stored in hidden scope (application private data)
 * - Automatic cleanup of temporary files
 */
export class GoogleDriveStorage implements IGoogleDriveStorage {
  private readonly GoogleSignInConfigure = {
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    webClientId: platformEnv.isDev
      ? '117481276073-fs7omuqsmvgtg6bci3ja1gvo03g0d984.apps.googleusercontent.com' // Dev
      : '94391474021-ffaspa4ikjqpqvn5ndplqobvuvhnj8v3.apps.googleusercontent.com', // Pro
    offlineAccess: true,
  };

  /**
   * Check if iOS platform (not supported)
   */
  private checkIOSNotSupported(): void {
    if (platformEnv.isNativeIOS) {
      throw new OneKeyLocalError(
        'Google Drive is not supported on iOS. Please use iCloud instead.',
      );
    }
  }

  /**
   * Check if Android platform (only supported platform)
   */
  private checkAndroidSupported(): void {
    if (!platformEnv.isNativeAndroid) {
      throw new OneKeyLocalError(
        'Google Drive is only supported on Android currently. Desktop and Web support coming soon.',
      );
    }
  }

  /**
   * Generate temporary file path for Google Drive operations
   */
  private getTempFilePath(fileName: string): string {
    if (!RNFS) {
      throw new OneKeyLocalError('File system not available');
    }
    const cacheDir = RNFS.CachesDirectoryPath ?? '';
    return `${cacheDir}/google_drive_${Date.now()}_${fileName}`;
  }

  /**
   * Clean up temporary file
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      if (RNFS && (await RNFS.exists(filePath))) {
        await RNFS.unlink(filePath);
      }
    } catch (error) {
      console.warn('Failed to cleanup temp file:', filePath, error);
    }
  }

  async isAvailable(): Promise<boolean> {
    this.checkIOSNotSupported();

    if (!platformEnv.isNativeAndroid) {
      return false;
    }

    try {
      await googlePlayService.isAvailable();
      await RNCloudFs.isAvailable();
      // Check if Google Play Services is available
      const signedIn = await GoogleSignin.isSignedIn();
      if (signedIn) {
        return true;
      }
      // User not signed in, but Google Sign-In is available
      return true;
    } catch (error) {
      console.warn('Google Drive availability check failed:', error);
      return false;
    }
  }

  // TODO signInIfNeeded()
  async signIn(): Promise<IGoogleUserInfo> {
    this.checkIOSNotSupported();
    this.checkAndroidSupported();

    console.log('GoogleDriveStorage___signIn >>>>> configure');

    GoogleSignin.configure(this.GoogleSignInConfigure);

    console.log('GoogleDriveStorage___signIn >>>>> configure done');

    try {
      const userInfo = await GoogleSignin.signIn();
      console.log('GoogleDriveStorage___signIn >>>>> signIn done');

      // Login to cloud storage
      await RNCloudFs.loginIfNeeded();

      return {
        email: userInfo.user.email,
        userId: userInfo.user.id,
      };
    } catch (error) {
      console.warn('GoogleDriveStorage___signIn >>>>> signIn error:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    this.checkIOSNotSupported();
    this.checkAndroidSupported();

    await GoogleSignin.signOut();
    await RNCloudFs.logout();
  }

  async isSignedIn(): Promise<boolean> {
    this.checkIOSNotSupported();

    if (!platformEnv.isNativeAndroid) {
      return false;
    }

    return GoogleSignin.isSignedIn();
  }

  async getUserInfo(): Promise<IGoogleUserInfo | null> {
    this.checkIOSNotSupported();
    this.checkAndroidSupported();

    await this.signIn();

    const signedIn = await GoogleSignin.isSignedIn();
    if (!signedIn) {
      return null;
    }

    try {
      const userInfo = await GoogleSignin.getCurrentUser();
      if (!userInfo) {
        return null;
      }

      return {
        email: userInfo.user.email,
        userId: userInfo.user.id,
      };
    } catch (error) {
      console.warn('Failed to get user info:', error);
      return null;
    }
  }

  async uploadFile(params: {
    fileName: string;
    content: string;
    folderId?: string;
  }): Promise<{ fileId: string }> {
    this.checkIOSNotSupported();
    this.checkAndroidSupported();

    const { fileName, content } = params;

    // Ensure user is signed in
    const signedIn = await GoogleSignin.isSignedIn();
    if (!signedIn) {
      throw new OneKeyLocalError(
        'Not signed in to Google. Please sign in first.',
      );
    }

    // Login to cloud storage if needed
    await RNCloudFs.loginIfNeeded();

    // Create temporary file from base64 content
    const tempFilePath = this.getTempFilePath(fileName);

    try {
      // Write base64 content to temporary file
      if (!RNFS) {
        throw new OneKeyLocalError('File system not available');
      }
      await RNFS.writeFile(tempFilePath, content, 'utf8');

      // Upload to Google Drive (hidden scope)
      const fileId = await RNCloudFs.copyToCloud({
        scope: 'hidden',
        sourcePath: { path: tempFilePath },
        targetPath: fileName,
      });

      return {
        fileId,
      };
    } finally {
      // Clean up temporary file
      await this.cleanupTempFile(tempFilePath);
    }
  }

  /**
   * Get file object from Google Drive by name
   */
  private async getFileObject(
    fileName: string,
  ): Promise<{ id: string; name: string } | undefined> {
    const { files }: { files: Array<{ id: string; name: string }> } =
      await RNCloudFs.listFiles({
        scope: 'hidden',
      });
    return files.find(({ name }) => fileName === name);
  }

  async downloadFile(params: {
    fileId: string;
  }): Promise<IGoogleDriveFile | null> {
    this.checkIOSNotSupported();
    this.checkAndroidSupported();

    const { fileId } = params;

    // Ensure user is signed in
    const signedIn = await GoogleSignin.isSignedIn();
    if (!signedIn) {
      throw new OneKeyLocalError(
        'Not signed in to Google. Please sign in first.',
      );
    }

    // Login to cloud storage if needed
    await RNCloudFs.loginIfNeeded();

    try {
      // Download file content as string
      const content = await RNCloudFs.getGoogleDriveDocument(fileId);

      return {
        id: fileId,
        content,
      };
    } catch (error) {
      console.warn('Failed to download file:', error);
      return null;
    }
  }

  async deleteFile(params: { fileId: string }): Promise<void> {
    this.checkIOSNotSupported();
    this.checkAndroidSupported();

    const { fileId } = params;

    // Ensure user is signed in
    const signedIn = await GoogleSignin.isSignedIn();
    if (!signedIn) {
      throw new OneKeyLocalError(
        'Not signed in to Google. Please sign in first.',
      );
    }

    // Login to cloud storage if needed
    await RNCloudFs.loginIfNeeded();

    await RNCloudFs.deleteFromCloud({ id: fileId });
  }

  async listFiles(params: {
    query?: string;
    pageSize?: number;
  }): Promise<{ files: IGoogleDriveFile[] }> {
    this.checkIOSNotSupported();
    this.checkAndroidSupported();

    // Ensure user is signed in
    const signedIn = await GoogleSignin.isSignedIn();
    if (!signedIn) {
      throw new OneKeyLocalError(
        'Not signed in to Google. Please sign in first.',
      );
    }

    // Login to cloud storage if needed
    await RNCloudFs.loginIfNeeded();

    const targetPath = params.query || '';

    const { files }: { files: Array<{ id: string; name: string }> } =
      await RNCloudFs.listFiles({
        scope: 'hidden',
      });

    // Convert to IGoogleDriveFile format (without content)
    const driveFiles: IGoogleDriveFile[] = files.map((file) => ({
      id: file.id,
      name: file.name,
      content: '', // Content not loaded in list view
    }));

    // Apply page size limit if specified
    if (params.pageSize && params.pageSize > 0) {
      return { files: driveFiles.slice(0, params.pageSize) };
    }

    return { files: driveFiles };
  }

  async fileExists(params: { fileId: string }): Promise<boolean> {
    this.checkIOSNotSupported();
    this.checkAndroidSupported();

    return RNCloudFs.fileExists({ fileId: params.fileId });
  }
}

/**
 * Singleton instance of GoogleDriveStorage
 * Use this instance throughout the application for Google Drive operations
 */
export const googleDriveStorage = new GoogleDriveStorage();
