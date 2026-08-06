import { createHash } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import DesktopApiFirmwareArtifact, {
  isFirmwareArtifactUrlAllowed,
} from './DesktopApiFirmwareArtifact';

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/onekey-firmware-artifact-jest'),
  },
  session: { defaultSession: { fetch: jest.fn() } },
}));

describe('DesktopApiFirmwareArtifact URL admission', () => {
  afterEach(async () => {
    await rm('/tmp/onekey-firmware-artifact-jest', {
      recursive: true,
      force: true,
    });
  });

  it('accepts only exact reviewed artifact hosts', () => {
    expect(
      isFirmwareArtifactUrlAllowed(
        new URL('https://web.onekey-asset.com/firmware.bin'),
      ),
    ).toBe(true);
    expect(
      isFirmwareArtifactUrlAllowed(
        new URL(
          'https://pub-d5c080673b4e4e9dae7e03680340378d.r2.dev/firmware.bin',
        ),
      ),
    ).toBe(true);
    expect(
      isFirmwareArtifactUrlAllowed(
        new URL('https://web.onekey-asset.com.evil.test/firmware.bin'),
      ),
    ).toBe(false);
    expect(
      isFirmwareArtifactUrlAllowed(
        new URL('https://common.onekey-asset.com:8443/firmware.bin'),
      ),
    ).toBe(false);
  });

  it('probes its root and keeps the minimum lease lifecycle in memory', async () => {
    const adapter = new DesktopApiFirmwareArtifact({
      desktopApi: {} as never,
    });
    expect(adapter.getCapabilities()).toMatchObject({
      firmwareArtifactProtocolVersion: 3,
      supportedRouteTypes: ['domain'],
      maxReadBytes: 256 * 1024,
    });
    const transactionId = 'fwtx:00000000-0000-4000-8000-000000000001';
    const lease = await adapter.createLease(transactionId);
    await adapter.releaseLease({
      leaseRef: lease.leaseRef,
      disposition: 'safeCancelled',
    });
  });

  it('rejects cancelled transactions until their lease is released', async () => {
    const adapter = new DesktopApiFirmwareArtifact({
      desktopApi: {} as never,
    });
    const transactionId = 'fwtx:00000000-0000-4000-8000-000000000002';
    const lease = await adapter.createLease(transactionId);
    const input = {
      taskId: 'firmware',
      transactionId,
      leaseRef: lease.leaseRef,
      artifactId: 'firmware',
      url: 'https://web.onekey-asset.com/firmware.bin',
      route: { routeType: 'domain' } as const,
      expectedSize: 1,
      expectedSha256: 'a'.repeat(64),
      maxBytes: 1,
      overallDeadlineSeconds: 1,
    };
    await adapter.cancelDownloads(transactionId);
    await expect(adapter.download(input)).rejects.toThrow('ARTIFACT_CANCELLED');
    await adapter.releaseLease({
      leaseRef: lease.leaseRef,
      disposition: 'safeCancelled',
    });
    const nextLease = await adapter.createLease(transactionId);
    await expect(
      adapter.download({ ...input, leaseRef: nextLease.leaseRef }),
    ).rejects.toThrow('ARTIFACT_NETWORK_FAILED');
  });

  it('uses distinct partial files for the same artifact across transactions', async () => {
    const adapter = new DesktopApiFirmwareArtifact({
      desktopApi: {} as never,
    });
    const artifact = Buffer.from('firmware artifact');
    const expectedSha256 = createHash('sha256').update(artifact).digest('hex');
    const partialPaths: string[] = [];
    const adapterWithStream = adapter as unknown as {
      streamResponseToFile(
        input: Parameters<DesktopApiFirmwareArtifact['download']>[0],
        partialPath: string,
        resumeOffset: number,
      ): Promise<void>;
    };
    jest
      .spyOn(adapterWithStream, 'streamResponseToFile')
      .mockImplementation(async (_input, partialPath) => {
        partialPaths.push(partialPath);
        await writeFile(partialPath, artifact);
      });
    const transactionIds = [
      'fwtx:00000000-0000-4000-8000-000000000003',
      'fwtx:00000000-0000-4000-8000-000000000004',
    ];
    const leases = await Promise.all(
      transactionIds.map((transactionId) => adapter.createLease(transactionId)),
    );
    const baseInput = {
      taskId: `fw-${expectedSha256.slice(0, 24)}`,
      artifactId: 'firmware',
      url: 'https://web.onekey-asset.com/firmware.bin',
      route: { routeType: 'domain' } as const,
      expectedSize: artifact.byteLength,
      expectedSha256,
      maxBytes: artifact.byteLength,
      overallDeadlineSeconds: 30,
    };

    await expect(
      Promise.all(
        transactionIds.map((transactionId, index) =>
          adapter.download({
            ...baseInput,
            transactionId,
            leaseRef: leases[index].leaseRef,
          }),
        ),
      ),
    ).resolves.toHaveLength(2);
    expect(partialPaths).toHaveLength(2);
    expect(new Set(partialPaths).size).toBe(2);
    expect(
      partialPaths.every((value) => path.extname(value) === '.partial'),
    ).toBe(true);
  });

  it('restarts an unverified partial instead of mixing responses across attempts', async () => {
    const adapter = new DesktopApiFirmwareArtifact({
      desktopApi: {} as never,
    });
    const transactionId = 'fwtx:00000000-0000-4000-8000-000000000005';
    const taskId = 'firmware-without-integrity';
    const url = 'https://web.onekey-asset.com/firmware.bin';
    const downloadToken = createHash('sha256').update(url).digest('hex');
    const transactionToken = createHash('sha256')
      .update(transactionId)
      .digest('hex')
      .slice(0, 16);
    const partialPath = path.join(
      '/tmp/onekey-firmware-artifact-jest',
      `${downloadToken}.${taskId}.${transactionToken}.partial`,
    );
    await writeFile(partialPath, Buffer.from('stale partial'));
    const artifact = Buffer.from('complete firmware artifact');
    const actualSha256 = createHash('sha256').update(artifact).digest('hex');
    const resumeOffsets: number[] = [];
    const adapterWithStream = adapter as unknown as {
      streamResponseToFile(
        input: Parameters<DesktopApiFirmwareArtifact['download']>[0],
        targetPath: string,
        resumeOffset: number,
      ): Promise<void>;
    };
    jest
      .spyOn(adapterWithStream, 'streamResponseToFile')
      .mockImplementation(async (_input, targetPath, resumeOffset) => {
        resumeOffsets.push(resumeOffset);
        await writeFile(targetPath, artifact);
      });
    const { leaseRef } = await adapter.createLease(transactionId);

    await expect(
      adapter.download({
        taskId,
        transactionId,
        leaseRef,
        artifactId: 'firmware',
        url,
        route: { routeType: 'domain' },
        maxBytes: 512 * 1024 * 1024,
        overallDeadlineSeconds: 30,
      }),
    ).resolves.toEqual({
      artifactRef: `fw:${actualSha256}`,
      size: artifact.byteLength,
      sha256: actualSha256,
    });
    expect(resumeOffsets).toEqual([0]);
  });
});
