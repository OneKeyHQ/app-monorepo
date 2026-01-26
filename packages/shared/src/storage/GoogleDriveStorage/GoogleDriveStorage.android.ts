import { GoogleSignin } from '@react-native-google-signin/google-signin';
// https://github.com/npomfret/react-native-cloud-fs
// https://github.com/rainbow-me/react-native-cloud-fs
// https://github.com/OneKeyHQ/react-native-cloud-fs
import RNCloudFs from 'react-native-cloud-fs';

import googlePlayService from '@onekeyhq/shared/src/googlePlayService/googlePlayService';

import { GoogleSignInConfigure } from '../../consts/googleSignConsts';
import { OneKeyLocalError } from '../../errors';
import RNFS from '../../modules3rdParty/react-native-fs';
import platformEnv from '../../platformEnv';

import type { IGoogleDriveFile, IGoogleUserInfo } from './types';

// packages/shared/src/cloudfs/index.android.ts
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

const APP_PRIVATE_DATA_SCOPE = 'hidden';
export class GoogleDriveStorage {
  /**
   * Generate temporary file path for Google Drive operations
   */
  private buildTempFilePath(fileName: string): string {
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
    try {
      const isGooglePlayServiceAvailable =
        await googlePlayService.isAvailable();
      if (!isGooglePlayServiceAvailable) {
        return false;
      }
      // Check if Google Play Services is available
      const hasPreviousSignedIn = GoogleSignin.hasPreviousSignIn();
      if (hasPreviousSignedIn) {
        try {
          const response = await GoogleSignin.signInSilently();
          if (response.type === 'success') {
            await RNCloudFs.loginIfNeeded();
            return true;
          }
        } catch (error) {
          console.warn('Google Drive availability check failed:', error);
          return false;
        }
      }
      return false;
    } catch (error) {
      console.warn('Google Drive availability check failed:', error);
      return false;
    }
  }

  async loginIfNeeded({
    showSignInDialog,
  }: {
    showSignInDialog: boolean;
  }): Promise<boolean> {
    GoogleSignin.configure(GoogleSignInConfigure);
    const hasPreviousSignedIn = GoogleSignin.hasPreviousSignIn();
    if (!hasPreviousSignedIn) {
      if (showSignInDialog) {
        await GoogleSignin.signIn();
      } else {
        await GoogleSignin.signInSilently();
      }
    } else {
      await GoogleSignin.signInSilently();
    }
    return RNCloudFs.loginIfNeeded();
  }

  async logout({
    revokeAccess = true,
  }: {
    revokeAccess?: boolean;
  } = {}): Promise<void> {
    if (revokeAccess) {
      await GoogleSignin.revokeAccess();
    }
    await GoogleSignin.signOut();
    await RNCloudFs.logout();
  }

  async isSignedIn(): Promise<boolean> {
    if (!platformEnv.isNativeAndroid) {
      return false;
    }
    return GoogleSignin.hasPreviousSignIn();
  }

  async getUserInfo(): Promise<IGoogleUserInfo | null> {
    await this.loginIfNeeded({ showSignInDialog: false });

    const hasPreviousSignedIn = GoogleSignin.hasPreviousSignIn();
    if (!hasPreviousSignedIn) {
      return null;
    }

    const userInfo: IGoogleUserInfo | null = GoogleSignin.getCurrentUser();
    return userInfo;
  }

  async uploadFile(params: {
    fileName: string;
    content: string;
  }): Promise<{ fileId: string }> {
    const { fileName, content } = params;

    // Ensure user is signed in
    const hasPreviousSignedIn = GoogleSignin.hasPreviousSignIn();
    if (!hasPreviousSignedIn) {
      throw new OneKeyLocalError(
        'Not signed in to Google. Please sign in first.',
      );
    }

    // Login to cloud storage if needed
    await RNCloudFs.loginIfNeeded();

    // Create temporary file from base64 content
    const tempFilePath = this.buildTempFilePath(fileName);

    try {
      // Write base64 content to temporary file
      if (!RNFS) {
        throw new OneKeyLocalError('File system not available');
      }
      await RNFS.writeFile(tempFilePath, content, 'utf8');

      // Upload to Google Drive (hidden scope)
      const fileId = await RNCloudFs.copyToCloud({
        scope: APP_PRIVATE_DATA_SCOPE,
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

  async getFileObject({
    fileName,
  }: {
    fileName: string;
  }): Promise<{ id: string; name: string } | undefined> {
    const { files }: { files: Array<{ id: string; name: string }> } =
      await RNCloudFs.listFiles({
        scope: APP_PRIVATE_DATA_SCOPE,
      });
    return files.find(({ name }) => fileName === name);
  }

  async downloadFile(params: {
    fileId: string;
  }): Promise<IGoogleDriveFile | null> {
    const { fileId } = params;

    // Ensure user is signed in
    const hasPreviousSignedIn = GoogleSignin.hasPreviousSignIn();
    if (!hasPreviousSignedIn) {
      throw new OneKeyLocalError(
        'Not signed in to Google. Please sign in first.',
      );
    }

    // Login to cloud storage if needed
    await RNCloudFs.loginIfNeeded();

    // Download file content as string
    const content = await RNCloudFs.getGoogleDriveDocument(fileId);

    return {
      id: fileId,
      content,
    };
  }

  async deleteFile(params: { fileId: string }): Promise<boolean> {
    const { fileId } = params;

    // Ensure user is signed in
    const hasPreviousSignedIn = GoogleSignin.hasPreviousSignIn();
    if (!hasPreviousSignedIn) {
      throw new OneKeyLocalError(
        'Not signed in to Google. Please sign in first.',
      );
    }

    // Login to cloud storage if needed
    await RNCloudFs.loginIfNeeded();

    return RNCloudFs.deleteFromCloud({ id: fileId });
  }

  async listFiles(): Promise<{ files: IGoogleDriveFile[] }> {
    // Ensure user is signed in
    const hasPreviousSignedIn = GoogleSignin.hasPreviousSignIn();
    if (!hasPreviousSignedIn) {
      throw new OneKeyLocalError(
        'Not signed in to Google. Please sign in first.',
      );
    }

    // Login to cloud storage if needed
    await RNCloudFs.loginIfNeeded();

    const { files }: { files: Array<{ id: string; name: string }> } =
      await RNCloudFs.listFiles({
        scope: APP_PRIVATE_DATA_SCOPE,
      });

    // Convert to IGoogleDriveFile format (without content)
    const driveFiles: IGoogleDriveFile[] = files;

    return { files: driveFiles };
  }

  async fileExists(params: { fileId: string }): Promise<boolean> {
    return RNCloudFs.fileExists({ fileId: params.fileId });
  }
}

/**
 * Singleton instance of GoogleDriveStorage
 * Use this instance throughout the application for Google Drive operations
 */
export const googleDriveStorage = new GoogleDriveStorage();
