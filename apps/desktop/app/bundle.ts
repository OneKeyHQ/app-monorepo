import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { app, dialog } from 'electron';
import logger from 'electron-log/main';
import { readCleartextMessage, readKey } from 'openpgp';
import semver from 'semver';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { PUBLIC_KEY } from './constant/gpg';
import { ElectronTranslations } from './i18n';
import {
  clearUpdateBundleData,
  getNativeBuildNumber,
  getNativeVersion,
} from './libs/store';

const readMetadataFileSha256 = async (signature: string) => {
  try {
    const ascFileMessage = signature;
    if (!ascFileMessage) {
      return '';
    }
    logger.info('auto-updater', `signatureFileContent: ${ascFileMessage}`);

    const signedMessage = await readCleartextMessage({
      cleartextMessage: ascFileMessage,
    });
    const publicKey = await readKey({ armoredKey: PUBLIC_KEY });
    const result = await signedMessage.verify([publicKey]);
    // Get result (validity of the signature)
    const valid = await result[0].verified;
    logger.info('auto-updater', `file valid: ${String(valid)}`);
    if (valid) {
      const text = signedMessage.getText();
      logger.info('auto-updater', `text: ${text}`);
      const json = JSON.parse(text) as {
        sha256: string;
      };
      const sha256 = json.sha256;
      logger.info('auto-updater', `getSha256 from asc file: ${sha256}`);
      return sha256;
    }
    throw new OneKeyLocalError(
      ElectronTranslations.update_signature_verification_failed_alert_text,
    );
  } catch (error) {
    logger.error(
      'auto-updater',
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      `getSha256 Error: ${(error as any).toString()}`,
    );
    const { message } = error as { message: string };

    const lowerCaseMessage = message.toLowerCase();
    const isInValid =
      lowerCaseMessage.includes('signed digest did not match') ||
      lowerCaseMessage.includes('misformed armored text') ||
      lowerCaseMessage.includes('ascii armor integrity check failed');
    throw new OneKeyLocalError(
      isInValid
        ? ElectronTranslations.update_signature_verification_failed_alert_text
        : ElectronTranslations.update_installation_package_possibly_compromised,
    );
  }
};

// Side-channel reason from the most recent SHA256 operation.
// Stamped by calculateSHA256 / verifySha256 before they return or throw, so
// callers (notably DesktopApiBundleUpdate.verifyAndResolve) can attach a
// specific subtype to telemetry — splitting the previously opaque
// "Downloaded file is not valid" bucket into FILE_NOT_FOUND / FILE_EMPTY /
// PERMISSION_DENIED / IS_DIRECTORY / OOM / IO_<code> / MISMATCH /
// EMPTY_PATH / EMPTY_EXPECTED_HASH categories that match the iOS/Android
// nitro module subtypes for cross-platform mixpanel funnels.
//
// Module-scoped is safe today because every call site stamps and reads
// the reason synchronously without an `await` between them, and Node.js
// runs each synchronous stretch to completion. DO NOT introduce an
// `await` between a verifySha256 / calculateSHA256 call and the
// corresponding lastSHA256FailureReason() read — a concurrent SHA op
// landing in that gap would silently overwrite the stamp and cross-
// contaminate analytics buckets. (The earlier "serialize via
// isDownloading" claim was wrong: only downloadBundle is gated, not
// the verify* / metadata SHA paths.)
let _lastSHA256FailureReason: string | undefined;

export const lastSHA256FailureReason = (): string | undefined =>
  _lastSHA256FailureReason;

const stampSHA256Failure = (reason: string | undefined) => {
  _lastSHA256FailureReason = reason;
};

const classifySHA256Error = (error: unknown): string => {
  const errno = (error as NodeJS.ErrnoException | null)?.code;
  switch (errno) {
    case 'ENOENT':
      return 'FILE_NOT_FOUND';
    case 'EACCES':
    case 'EPERM':
      return 'PERMISSION_DENIED';
    case 'EISDIR':
      return 'IS_DIRECTORY';
    case 'ENOSPC':
      return 'DISK_FULL';
    case 'EMFILE':
    case 'ENFILE':
      return 'TOO_MANY_OPEN_FILES';
    default:
      break;
  }
  if (error instanceof RangeError) {
    // V8 buffer allocation overflow on multi-GB files / heap exhaustion.
    return 'OOM';
  }
  if (errno) return `IO_${errno}`;
  const ctor = (error as { constructor?: { name?: string } } | null)
    ?.constructor?.name;
  return ctor ? `IO_${ctor}` : 'IO_UNKNOWN';
};

export const calculateSHA256 = (filePath: string) => {
  stampSHA256Failure(undefined);
  if (!filePath) {
    stampSHA256Failure('EMPTY_PATH');
    return '';
  }
  try {
    // Reject empty files before hashing so the SHA-of-empty digest
    // (e3b0c44…b855) doesn't silently propagate as a clean "MISMATCH"
    // when the real cause is a truncated / zero-byte download. Mirrors
    // the explicit FILE_EMPTY checks in the iOS / Android calculators.
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      stampSHA256Failure('FILE_EMPTY');
      return '';
    }
    const hashSum = crypto.createHash('sha256');
    const fileBuffer = fs.readFileSync(filePath);
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    stampSHA256Failure(classifySHA256Error(error));
    throw error;
  }
};

export const verifySha256 = (filePath: string, sha256: string) => {
  stampSHA256Failure(undefined);
  if (!filePath) {
    stampSHA256Failure('EMPTY_PATH');
    return false;
  }
  if (!sha256) {
    stampSHA256Failure('EMPTY_EXPECTED_HASH');
    return false;
  }
  // calculateSHA256 stamps its own reason before throwing; preserve it by
  // catching here so the upstream Promise-based callers (verifyAndResolve)
  // can still read lastSHA256FailureReason() on a false result.
  let fileSha256: string;
  try {
    fileSha256 = calculateSHA256(filePath);
  } catch {
    return false;
  }
  if (!fileSha256) {
    return false;
  }
  logger.info('bundle-download-verifySha256', sha256, fileSha256);
  if (fileSha256 !== sha256) {
    stampSHA256Failure('MISMATCH');
    return false;
  }
  return true;
};

export const getBundleDirName = () => {
  const tempDir = path.join(app.getPath('userData'), 'onekey-bundle');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  logger.info('getBundleDirName', tempDir);
  return tempDir;
};

export const getBundleExtractDir = ({
  appVersion,
  bundleVersion,
}: {
  appVersion: string;
  bundleVersion: string;
}) => {
  const bundleDir = getBundleDirName();
  return path.join(bundleDir, `${appVersion}-${bundleVersion}`);
};

export const getBundleIndexHtmlPath = ({
  appVersion,
  bundleVersion,
}: {
  appVersion: string;
  bundleVersion: string;
}) => {
  if (!appVersion || !bundleVersion) {
    return undefined;
  }
  const prevNativeVersion = getNativeVersion();
  if (!prevNativeVersion) {
    return undefined;
  }
  const currentAppVersion = app.getVersion();
  const currentBuildNumber = process.env.BUILD_NUMBER ?? '';
  const prevBuildNumber = getNativeBuildNumber();
  logger.info(
    'getBundleIndexHtmlPath: check appVersion and prevNativeVersion',
    currentAppVersion,
    prevNativeVersion,
    'buildNumber:',
    currentBuildNumber,
    prevBuildNumber,
  );
  if (!semver.eq(currentAppVersion, prevNativeVersion)) {
    clearUpdateBundleData();
    return undefined;
  }
  if (
    currentBuildNumber &&
    prevBuildNumber &&
    currentBuildNumber !== prevBuildNumber
  ) {
    logger.info(
      'getBundleIndexHtmlPath: buildNumber changed, clearing bundle data',
      currentBuildNumber,
      prevBuildNumber,
    );
    clearUpdateBundleData();
    return undefined;
  }
  const extractDir = getBundleExtractDir({
    appVersion: appVersion || '1.0.0',
    bundleVersion: bundleVersion || '1',
  });
  if (!fs.existsSync(extractDir)) {
    return undefined;
  }
  const indexHtmlPath = path.join(extractDir, 'build', 'index.html');
  logger.info('bundle-download-getBundleIndexHtmlPath', indexHtmlPath);
  return fs.existsSync(indexHtmlPath) ? indexHtmlPath : undefined;
};

export const checkFileSha512 = (filePath: string, sha512: string) => {
  const file = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha512').update(file).digest('hex');
  return hash === sha512;
};

const getMetadataFilePath = ({
  appVersion,
  bundleVersion,
}: {
  appVersion: string;
  bundleVersion: string;
}) => {
  const bundleDir = getBundleExtractDir({
    appVersion: appVersion || '1.0.0',
    bundleVersion: bundleVersion || '1',
  });
  return path.join(bundleDir, 'metadata.json');
};

export const verifyMetadataFileSha256 = async ({
  appVersion,
  bundleVersion,
  signature,
}: {
  appVersion: string;
  bundleVersion: string;
  signature: string;
}) => {
  const metadataFilePath = getMetadataFilePath({
    appVersion,
    bundleVersion,
  });
  logger.info('bundle-verifyBundleASC', metadataFilePath);
  const metadataFilesSha256 = await readMetadataFileSha256(signature);
  const isVerified = verifySha256(metadataFilePath, metadataFilesSha256);
  if (!isVerified) {
    throw new OneKeyLocalError('Invalid asc file');
  }
  return true;
};

export const getMetadata = async ({
  bundleDir,
  appVersion,
  bundleVersion,
  signature,
}: {
  bundleDir: string;
  appVersion: string;
  bundleVersion: string;
  signature: string;
}): Promise<Record<string, string>> => {
  const metadataPath = path.join(bundleDir, '..', 'metadata.json');
  // Intentionally global in QA skip-gpg builds: startup metadata verification
  // follows build-time policy rather than per-request runtime toggles.
  const allowSkipGPG =
    String(process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION) === 'true';
  if (!allowSkipGPG) {
    await verifyMetadataFileSha256({ appVersion, bundleVersion, signature });
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as Record<
    string,
    string
  >;
  return metadata;
};

const TEST_SIGNATURE = `
-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA256

{
  "fileName": "metadata.json",
  "sha256": "bf3734ac6e59388fe23c40ce2960b6fd197c596af05dd08b3ccc8b201b78c52b",
  "size": 167265,
  "generatedAt": "2026-03-31T03:25:05.000Z",
  "appVersion": "6.1.0",
  "buildNumber": "2026032032",
  "bundleVersion": "7701116",
  "appType": "electron"
}
-----BEGIN PGP SIGNATURE-----

iQJCBAEBCAAsFiEE62iuVE8f3YzSZGJPs2mmepC/OHsFAmnLXs0OHGRldkBvbmVr
ZXkuc28ACgkQs2mmepC/OHtUkhAAoMZQc/Z1slPudePNjgO33XZwhWJNQkLeyPRL
Evz6JowioGdQjk1yJ+2jleSDDHRCceh6BzeqZqCFP58oRqug3MS4x1/7Egvza3l8
5vW+NeX9Ai8l4PniUDcC9IwBITsVz/wzjQdhOuVbtYcP4y/48JvctBNBj5cG7cG7
pMvOiXffUWjrBHToAKJec6V1N5L2b/2K3dutp10o3+tkfOznsHaD1vCpwxaeWcMx
W2I2SsH3uBDRYisY5W5mb5mDPbEuyqL+M+TLxHAGPwRe3+ExeipakPIJFfYsf5zi
6AnlllUv/QBH+1VZ7KauadPLD1HfMCPSbqQuTsgay56H7fvUe9khp2ysftgQ2tpc
NzTtQyZqIUeiUwBSTGqUvuLMCRChfGo7OBJE7Ec/VRzUIwGmN4Je+nY1JTYW+iR5
cRQ9j+aNAhLYLPkdUr9hMXaDjpSdGCBM0YpEoqSOzbuZEVCD92tzdfMUI+bdC6a/
I5cI5w1KTRKJ8irMfzm/TDcIenoUTvhzwqm+v69vFSR1LqWQMXnRvhONNTa9haov
+s+6KSUKPMH4Pa5AgRu5dkoj3UrbZUwt3tOIao97PXVXaFuSBLNhFEjS5yV+uOgK
Wfi3u5D2NWfhq0ZaV25yC16xDIe7SOXgHjNnR1vtt5L9ThZ2deidyiBJA6BFHZK6
RNAOJKE=
=JKzr
-----END PGP SIGNATURE-----`;
export const testExtractedSha256FromVerifyAscFile = async () => {
  const result = await readMetadataFileSha256(TEST_SIGNATURE);
  return (
    result ===
    'bf3734ac6e59388fe23c40ce2960b6fd197c596af05dd08b3ccc8b201b78c52b'
  );
};

const unmatchedFileDialog = (): void => {
  setTimeout(() => {
    void dialog
      .showMessageBox({
        type: 'error',
        message:
          'File tampering detected, please contact customer service to update the client',
        buttons: ['exit it'],
      })
      .then((selection) => {
        if (selection.response === 0) {
          app.exit();
        }
      });
  });
};

export const getBundleDirPath = () => {
  const indexHtmlPath =
    globalThis.$desktopMainAppFunctions?.getBundleIndexHtmlPath?.();
  return indexHtmlPath ? path.dirname(indexHtmlPath) : '';
};

const isWin = process.platform === 'win32';
export const getDriveLetter = () => {
  const appPath = app.getAppPath();
  return isWin ? appPath.substring(0, 3) : '';
};
export const checkFileHash = ({
  bundleDirPath,
  metadata,
  driveLetter,
  url,
}: {
  bundleDirPath: string;
  metadata: Record<string, string>;
  driveLetter: string;
  url: string;
}) => {
  if (!bundleDirPath) {
    throw new OneKeyLocalError('Bundle directory path not found');
  }
  const replacedKey = url.replace(/^\/+/, '').trim();
  let key = replacedKey || 'index.html';
  // Handle Windows path separators
  if (isWin) {
    key = key
      .replace(/\\/g, '/')
      .replace(bundleDirPath.replace(/\\/g, '/'), '')
      .replace(driveLetter, '')
      .replace('C:/', '');

    // Remove leading slash if present
    if (key.startsWith('/')) {
      key = key.replace(/^\/+/, '').trim();
    }
  }
  if (!metadata[key]) {
    logger.info(
      `${key}: File ${url} ${bundleDirPath} not found in metadata.json`,
    );
    key = 'index.html';
  }
  const sha512 = metadata[key];
  const filePath = path.join(bundleDirPath, key);
  if (!sha512) {
    logger.info(
      'checkFileHash error:',
      `${key}: ${url}, sha512 not found in metadata.json`,
    );
    unmatchedFileDialog();
    throw new OneKeyLocalError(
      `File ${url}, sha512 not found in metadata.json`,
    );
  }
  if (!checkFileSha512(filePath, sha512)) {
    logger.info(
      'checkFileHash error:',
      `${key}:  ${url} not matched ${filePath}: ${sha512}`,
    );
    unmatchedFileDialog();
    throw new OneKeyLocalError(`File ${url} sha512 mismatch`);
  }
  return filePath;
};
