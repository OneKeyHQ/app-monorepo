/* eslint-disable spellcheck/spell-checker */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { app } from 'electron';
import logger from 'electron-log/main';
import { readCleartextMessage, readKey } from 'openpgp';
import semver from 'semver';

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
  if (!appVersion || !bundleVersion) {
    return undefined;
  }
  if (semver.lt(platformEnv.version || '1.0.0', appVersion)) {
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

const TEST_SIGNATURE = `
-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA256

{
  "fileName": "metadata.json",
  "sha256": "2ada9c871104fc40649fa3de67a7d8e33faadc18e9abd587e8bb85be0a003eba",
  "size": 158590,
  "generatedAt": "2025-09-19T07:49:13.000Z"
}
-----BEGIN PGP SIGNATURE-----

iQJCBAEBCAAsFiEE62iuVE8f3YzSZGJPs2mmepC/OHsFAmjNJ1IOHGRldkBvbmVr
ZXkuc28ACgkQs2mmepC/OHs6Rw/9FKHl5aNsE7V0IsFf/l+h16BYKFwVsL69alMk
CFLna8oUn0+tyECF6wKBKw5pHo5YR27o2pJfYbAER6dygDF6WTZ1lZdf5QcBMjGA
LCeXC0hzUBzSSOH4bKBTa3fHp//HdSV1F2OnkymbXqYN7WXvuQPLZ0nV6aU88hCk
HgFifcvkXAnWKoosUtj0Bban/YBRyvmQ5C2akxUPEkr4Yck1QXwzJeNRd7wMXHjH
JFK6lJcuABiB8wpJDXJkFzKs29pvHIK2B2vdOjU2rQzKOUwaKHofDi5C4+JitT2b
2pSeYP3PAxXYw6XDOmKTOiC7fPnfLjtcPjNYNFCezVKZT6LKvZW9obnW8Q9LNJ4W
okMPgHObkabv3OqUaTA9QNVfI/X9nvggzlPnaKDUrDWTf7n3vlrdexugkLtV/tJA
uguPlI5hY7Ue5OW7ckWP46hfmq1+UaIdeUY7dEO+rPZDz6KcArpaRwBiLPBhneIr
/X3KuMzS272YbPbavgCZGN9xJR5kZsEQE5HhPCbr6Nf0qDnh+X8mg0tAB/U6F+ZE
o90sJL1ssIaYvST+VWVaGRr4V5nMDcgHzWSF9Q/wm22zxe4alDaBdvOlUseW0iaM
n2DMz6gqk326W6SFynYtvuiXo7wG4Cmn3SuIU8xfv9rJqunpZGYchMd7nZektmEJ
91Js0rQ=
=A/Ii
-----END PGP SIGNATURE-----`;
export const testExtractedSha256FromVerifyAscFile = async () => {
  const result = await readMetadataFileSha256(TEST_SIGNATURE);
  return (
    result ===
    '2ada9c871104fc40649fa3de67a7d8e33faadc18e9abd587e8bb85be0a003eba'
  );
};
