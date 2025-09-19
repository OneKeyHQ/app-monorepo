import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { app } from 'electron';
import logger from 'electron-log/main';
import { readCleartextMessage, readKey } from 'openpgp';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PUBLIC_KEY } from './constant/gpg';
import { ETranslations } from './i18n';

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
      const texts = signedMessage.getText();
      const json = JSON.parse(texts) as {
        sha256: string;
      };
      const sha256 = json.sha256;
      logger.info('auto-updater', `getSha256 from asc file: ${sha256}`);
      return sha256;
    }
    throw new OneKeyLocalError(
      ETranslations.update_signature_verification_failed_alert_text,
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
        ? ETranslations.update_signature_verification_failed_alert_text
        : ETranslations.update_installation_package_possibly_compromised,
    );
  }
};

export const verifySha256 = (filePath: string, sha256: string) => {
  const hashSum = crypto.createHash('sha256');
  const fileBuffer = fs.readFileSync(filePath);
  hashSum.update(fileBuffer);
  const fileSha256 = hashSum.digest('hex');
  logger.info('bundle-download-verifySha256', sha256, fileSha256);
  return fileSha256 === sha256;
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
  if (platformEnv.version !== appVersion) {
    return undefined;
  }
  const extractDir = getBundleExtractDir({
    appVersion: platformEnv.version || '1.0.0',
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
}) => {
  const metadataPath = path.join(bundleDir, '..', 'metadata.json');
  await verifyMetadataFileSha256({ appVersion, bundleVersion, signature });
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as Record<
    string,
    string
  >;
  return metadata;
};
