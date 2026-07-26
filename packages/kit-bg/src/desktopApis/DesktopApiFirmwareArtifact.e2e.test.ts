import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import os from 'os';
import path from 'path';

import AdmZip from 'adm-zip';
// eslint-disable-next-line import/no-extraneous-dependencies
import selfsigned from 'selfsigned';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import DesktopApiFirmwareArtifact from './DesktopApiFirmwareArtifact';

import type { IDesktopApi } from './instance/IDesktopApi';
import type { AddressInfo } from 'net';

jest.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/onekey-firmware-artifact-e2e',
  },
}));

const firmwarePayload = Buffer.alloc(2 * 1024 * 1024, 0x5a);
const expectedSha256 = crypto
  .createHash('sha256')
  .update(firmwarePayload)
  .digest('hex');
const taskId = `fw-${expectedSha256}-${firmwarePayload.length}`;
const dropBytes = 64 * 1024;

const parseRange = (
  header: string | undefined,
): { start: number; end: number } => {
  const match = header?.match(/^bytes=(\d+)-(\d+)$/u);
  if (!match) {
    throw new OneKeyLocalError(`Unexpected Range header: ${header}`);
  }
  return { start: Number(match[1]), end: Number(match[2]) };
};

describe('DesktopApiFirmwareArtifact streaming e2e', () => {
  let rootDir: string;
  let server: https.Server;
  let url: string;
  let certificate: string;
  let dropDownloads = true;
  let servedPayload: Buffer = firmwarePayload;
  const downloadStarts: number[] = [];

  beforeAll(async () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'firmware-artifact-e2e-'));
    const pems = selfsigned.generate(
      [{ name: 'commonName', value: 'localhost' }],
      {
        days: 1,
        keySize: 2048,
        extensions: [
          {
            name: 'subjectAltName',
            altNames: [{ type: 2, value: 'localhost' }],
          },
        ],
      },
    );
    certificate = pems.cert;
    server = https.createServer(
      { key: pems.private, cert: pems.cert },
      (request, response) => {
        const range = parseRange(
          Array.isArray(request.headers.range)
            ? request.headers.range[0]
            : request.headers.range,
        );
        if (range.start === 0 && range.end === 0) {
          response.writeHead(206, {
            'Accept-Ranges': 'bytes',
            'Content-Length': 1,
            'Content-Range': `bytes 0-0/${servedPayload.length}`,
            ETag: '"firmware-e2e-v1"',
          });
          response.end(servedPayload.subarray(0, 1));
          return;
        }
        downloadStarts.push(range.start);
        const body = servedPayload.subarray(range.start, range.end + 1);
        response.writeHead(206, {
          'Accept-Ranges': 'bytes',
          'Content-Length': body.length,
          'Content-Range': `bytes ${range.start}-${range.end}/${servedPayload.length}`,
          ETag: '"firmware-e2e-v1"',
        });
        if (dropDownloads) {
          response.write(body.subarray(0, Math.min(dropBytes, body.length)));
          setTimeout(() => response.socket?.destroy(), 10);
          return;
        }
        response.end(body);
      },
    );
    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });
    const { port } = server.address() as AddressInfo;
    url = `https://localhost:${port}/firmware.bin`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    fs.rmSync(rootDir, { force: true, recursive: true });
  });

  test('resumes a pinned-IP partial on the canonical domain route and serves bounded reads', async () => {
    const api = new DesktopApiFirmwareArtifact({
      desktopApi: {} as IDesktopApi,
      rootDir,
      allowNonDefaultPortForTests: true,
      trustedCaForTests: certificate,
    });
    const { leaseRef } = await api.createLease({
      transactionId: 'transaction-e2e',
    });
    const common = {
      taskId,
      leaseRef,
      artifactId: taskId,
      url,
      expectedSize: firmwarePayload.length,
      expectedSha256,
      maxBytes: firmwarePayload.length,
      overallDeadlineSeconds: 29.5,
    };

    await expect(
      api.downloadArtifact({
        ...common,
        routeType: 'pinnedIp',
        resolvedIp: '127.0.0.1',
      }),
    ).rejects.toMatchObject({
      code: 'ARTIFACT_NETWORK_FAILED',
      retryable: true,
    });
    const failedStatus = await api.getArtifactStatus({ leaseRef, taskId });
    expect(failedStatus).toMatchObject({
      state: 'failed',
      errorCode: 'ARTIFACT_NETWORK_FAILED',
      retryable: true,
    });
    expect(failedStatus.downloadedBytes).toBeGreaterThan(0);
    const startsBeforeDomain = [...downloadStarts];

    dropDownloads = false;
    const receipt = await api.downloadArtifact({
      ...common,
      routeType: 'domain',
    });

    expect(downloadStarts.at(startsBeforeDomain.length)).toBeGreaterThan(0);
    expect(receipt).toMatchObject({
      size: firmwarePayload.length,
      sha256: expectedSha256,
    });
    expect(receipt).not.toHaveProperty('path');

    const reader = await api.openArtifact(receipt);
    expect(reader.maxReadBytes).toBe(256 * 1024);
    const chunk = await api.readArtifact({
      readerId: reader.readerId,
      offset: 0,
      length: reader.maxReadBytes,
    });
    expect(Buffer.from(chunk)).toEqual(
      firmwarePayload.subarray(0, reader.maxReadBytes),
    );
    await expect(
      api.readArtifact({
        readerId: reader.readerId,
        offset: 0,
        length: reader.maxReadBytes + 1,
      }),
    ).rejects.toMatchObject({
      code: 'ARTIFACT_READ_OUT_OF_RANGE',
    });
    await api.closeArtifact({ readerId: reader.readerId });
  });

  test('materializes an exact ZIP allow-list without loading the archive into JS', async () => {
    const entryBytes = Buffer.from('verified pro2 component bytes');
    const archive = new AdmZip();
    archive.addFile('firmware/P1.bin', entryBytes);
    servedPayload = archive.toBuffer();
    dropDownloads = false;
    const archiveSha256 = crypto
      .createHash('sha256')
      .update(servedPayload)
      .digest('hex');
    const archiveTaskId = `fw-${archiveSha256}-${servedPayload.length}`;
    const entrySha256 = crypto
      .createHash('sha256')
      .update(entryBytes)
      .digest('hex');
    const api = new DesktopApiFirmwareArtifact({
      desktopApi: {} as IDesktopApi,
      rootDir: path.join(rootDir, 'archive'),
      allowNonDefaultPortForTests: true,
      trustedCaForTests: certificate,
    });
    const { leaseRef } = await api.createLease({
      transactionId: 'transaction-archive-e2e',
    });
    const archiveReceipt = await api.downloadArtifact({
      taskId: archiveTaskId,
      leaseRef,
      artifactId: archiveTaskId,
      url,
      routeType: 'domain',
      expectedSize: servedPayload.length,
      expectedSha256: archiveSha256,
      maxBytes: servedPayload.length,
      overallDeadlineSeconds: 30,
    });

    const materialized = await api.materializeArchive({
      leaseRef,
      archiveArtifactRef: archiveReceipt.artifactRef,
      archiveImmutableToken: archiveReceipt.immutableToken,
      entries: [
        {
          archiveName: 'firmware/P1.bin',
          artifactId: 'pro2-p1',
          expectedSize: entryBytes.length,
          expectedSha256: entrySha256,
        },
      ],
    });

    expect(materialized.artifacts).toHaveLength(1);
    const child = materialized.artifacts[0];
    expect(child).toMatchObject({
      archiveName: 'firmware/P1.bin',
      artifactId: 'pro2-p1',
      receipt: {
        size: entryBytes.length,
        sha256: entrySha256,
      },
    });
    const reader = await api.openArtifact(child.receipt);
    const bytes = await api.readArtifact({
      readerId: reader.readerId,
      offset: 0,
      length: entryBytes.length,
    });
    expect(Buffer.from(bytes)).toEqual(entryBytes);
    await api.closeArtifact({ readerId: reader.readerId });
  });
});
