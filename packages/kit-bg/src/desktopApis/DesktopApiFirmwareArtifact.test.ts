import { rm } from 'node:fs/promises';

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

  it('probes its root and persists the minimum lease lifecycle', async () => {
    const adapter = new DesktopApiFirmwareArtifact({
      desktopApi: {} as never,
    });
    expect(adapter.getCapabilities()).toMatchObject({
      firmwareArtifactProtocolVersion: 1,
      maxReadBytes: 256 * 1024,
    });
    const transactionId = 'fwtx:00000000-0000-4000-8000-000000000001';
    const lease = await adapter.createLease(transactionId);
    await expect(
      adapter.reconcileLeases([lease.leaseRef]),
    ).resolves.toBeUndefined();
    await adapter.releaseLease({
      leaseRef: lease.leaseRef,
      disposition: 'safeCancelled',
    });
    await expect(adapter.reconcileLeases([])).resolves.toBeUndefined();
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
    await expect(adapter.download(input)).rejects.toMatchObject({
      code: 'ARTIFACT_CANCELLED',
    });
    await adapter.releaseLease({
      leaseRef: lease.leaseRef,
      disposition: 'safeCancelled',
    });
    const nextLease = await adapter.createLease(transactionId);
    await expect(
      adapter.download({ ...input, leaseRef: nextLease.leaseRef }),
    ).rejects.toMatchObject({
      code: 'ARTIFACT_NETWORK_FAILED',
    });
  });
});
