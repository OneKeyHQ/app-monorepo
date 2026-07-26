import { ReactNativeRangeDownloader } from '@onekeyfe/react-native-range-downloader';
import { describe, expect, test } from 'react-native-harness';

const MAX_FIRMWARE_READ_BYTES = 256 * 1024;

describe('Native firmware artifact recovery contract', () => {
  test('exposes the cross-repository artifact protocol required by the SDK', () => {
    const capabilities =
      ReactNativeRangeDownloader.getFirmwareArtifactCapabilities();

    expect(capabilities.firmwareArtifactProtocolVersion).toBe(1);
    expect(capabilities.maxReadBytes).toBe(MAX_FIRMWARE_READ_BYTES);
    expect(capabilities.supportedRouteTypes).toContain('domain');
    expect(capabilities.supportedRouteTypes).toContain('pinnedIp');
    expect(capabilities.supportsArchiveMaterialization).toBe(true);
  });

  test('keeps an active lease through bootstrap reconciliation and releases it only at a safe terminal state', async () => {
    const transactionId = `firmware-recovery-harness-${Date.now()}`;
    const { leaseRef } =
      await ReactNativeRangeDownloader.createFirmwareArtifactLease({
        transactionId,
      });
    const taskId = 'not-started-artifact';

    try {
      await ReactNativeRangeDownloader.reconcileFirmwareArtifactLeases({
        activeLeaseRefs: [leaseRef],
      });
      const beforeRecoverySweep =
        await ReactNativeRangeDownloader.sweepFirmwareArtifactOrphans();
      const status = await ReactNativeRangeDownloader.getFirmwareArtifactStatus(
        {
          leaseRef,
          taskId,
        },
      );

      expect(leaseRef.length).toBeGreaterThan(0);
      expect(beforeRecoverySweep.deletedFiles).toBeGreaterThanOrEqual(0);
      expect(beforeRecoverySweep.deletedBytes).toBeGreaterThanOrEqual(0);
      expect(status.state).toBe('notFound');
      expect(status.downloadedBytes).toBe(0);
    } finally {
      await ReactNativeRangeDownloader.releaseFirmwareArtifactLease({
        leaseRef,
        disposition: 'safeAbandoned',
      });
      await ReactNativeRangeDownloader.reconcileFirmwareArtifactLeases({
        activeLeaseRefs: [],
      });
      await ReactNativeRangeDownloader.sweepFirmwareArtifactOrphans();
    }
  });

  test('rejects stale opaque reader handles instead of exposing a native path', async () => {
    let error: unknown;
    try {
      await ReactNativeRangeDownloader.readFirmwareArtifact({
        readerId: 'stale-reader-from-previous-runtime',
        offset: 0,
        length: 1,
      });
    } catch (value) {
      error = value;
    }

    expect(error).toBeTruthy();
  });
});
