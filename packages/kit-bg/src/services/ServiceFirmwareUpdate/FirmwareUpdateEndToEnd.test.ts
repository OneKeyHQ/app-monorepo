import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import type { IIpTableConfigWithRuntime } from '@onekeyhq/shared/src/request/types/ipTable';

import {
  type ISimpleDbFirmwareManifestCacheData,
  SimpleDbEntityFirmwareManifestCache,
} from '../../dbs/simple/entity/SimpleDbEntityFirmwareManifestCache';

import { FirmwareArtifactProvider } from './FirmwareArtifactProvider';
import { FirmwareManifestProvider } from './FirmwareManifestProvider';
import {
  FirmwareUpdateCoordinator,
  type IFirmwareUpdateCoordinatorExecutor,
} from './FirmwareUpdateCoordinator';
import { FirmwareUpdateJournal } from './FirmwareUpdateJournal';

import type {
  IFirmwareArtifactRoute,
  IFirmwareStoredArtifact,
} from './FirmwareArtifactStore';
import type {
  IFirmwareManifestSelection,
  IFirmwarePreparedPlan,
  IFirmwareUpdatePlan,
} from './firmwareUpdateCoordinatorTypes';
import type { IFirmwareUpdateHostBinding } from './FirmwareUpdateRuntimeBinding';

const SELECTION: IFirmwareManifestSelection = {
  channel: 'stable',
  deviceModel: 'classic1s',
  firmwareField: 'firmware-v8',
  firmwareType: 'universal',
};
const TRANSACTION_ID = 'firmware-e2e-1';
const DEVICE_DIGEST = 'd'.repeat(64);

type IRawDataBuilder = (rawData: unknown) => unknown | Promise<unknown>;

class MemoryJournalStorage {
  rawData: unknown;

  private writeQueue: Promise<void> = Promise.resolve();

  async getRawData() {
    return this.rawData;
  }

  async setRawData(dataOrBuilder: unknown | IRawDataBuilder) {
    const write = async () => {
      const next =
        typeof dataOrBuilder === 'function'
          ? await (dataOrBuilder as IRawDataBuilder)(this.rawData)
          : dataOrBuilder;
      this.rawData = JSON.parse(JSON.stringify(next)) as unknown;
      return next;
    };
    const operation = this.writeQueue.then(write, write);
    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async clearRawData() {
    this.rawData = undefined;
  }
}

const createIpTableConfig = (
  hostnames: readonly string[],
): IIpTableConfigWithRuntime => ({
  config: {
    version: 1,
    ttl_sec: 300,
    generated_at: '2026-07-25T00:00:00.000Z',
    source: 'signed-remote',
    sourcePayloadHash: 'firmware-e2e',
    domains: Object.fromEntries(
      hostnames.map((hostname, index) => [
        hostname,
        {
          endpoints: [
            {
              ip: `203.0.113.${index + 10}`,
              provider: 'firmware-e2e',
              region: 'ALL',
              weight: 10,
            },
          ],
        },
      ]),
    ),
  },
  runtime: {
    enabled: true,
    lastUpdated: 0,
    lastRegionCheck: 0,
    selections: {},
    lastBestIp: {},
  },
});

const setupManifestCache = () => {
  const cache = new SimpleDbEntityFirmwareManifestCache();
  let data: ISimpleDbFirmwareManifestCacheData | undefined;
  jest.spyOn(cache, 'getRawData').mockImplementation(async () => data);
  jest.spyOn(cache, 'setRawData').mockImplementation(async (builder) => {
    data =
      typeof builder === 'function'
        ? await builder(data)
        : (builder as ISimpleDbFirmwareManifestCacheData);
    return data;
  });
  return cache;
};

const toStoredArtifact = ({
  requirement,
  leaseRef,
  route,
}: {
  requirement: IFirmwareUpdatePlan['artifacts'][number];
  leaseRef: string;
  route: IFirmwareArtifactRoute;
}): IFirmwareStoredArtifact => {
  if (
    requirement.expectedSize === undefined ||
    requirement.expectedSha256 === undefined ||
    requirement.container.kind !== 'raw'
  ) {
    throw new OneKeyLocalError(
      'Classic 1S end-to-end fixture requires a raw sized artifact',
    );
  }
  const artifactRef = `artifact-${requirement.artifactId}`;
  const adapterReceipt = {
    artifactRef,
    size: requirement.expectedSize,
    sha256: requirement.expectedSha256,
    immutableToken: `immutable-${requirement.artifactId}`,
  };
  return {
    taskId: `task-${requirement.artifactId}`,
    requirement,
    adapterReceipt,
    preparedReceipt: {
      artifactId: requirement.artifactId,
      role: requirement.role,
      target: requirement.target,
      artifactRef,
      size: requirement.expectedSize,
      sha256: requirement.expectedSha256,
      integrity: requirement.integrity,
      leaseId: leaseRef,
      materialization: {
        kind: 'raw',
      },
    },
    acquisition: {
      routeType: route.type,
      bytesReused: 0,
      resumeKind: 'none',
      resumeCount: 0,
    },
  };
};

describe('firmware external-only end-to-end preparation', () => {
  it('falls back to the bundled manifest, downloads by pinned IP, and executes only a PreparedPlan', async () => {
    const sdk = await CoreSDKLoader();
    const manifestAttempts: string[] = [];
    const manifestProvider = new FirmwareManifestProvider({
      now: () => 1000,
      loadCoreSdk: async () => sdk,
      getIpTableConfig: async () => createIpTableConfig(['data.onekey.so']),
      isSniSupported: () => true,
      isProxyActiveForUrl: async () => false,
      getRequestHeaders: async () => ({}),
      sniRequest: async ({ ip }) => {
        manifestAttempts.push(`sni:${ip}`);
        throw new OneKeyLocalError('manifest SNI unavailable');
      },
      domainRequest: async () => {
        manifestAttempts.push('domain');
        throw new OneKeyLocalError('manifest domain unavailable');
      },
      cache: setupManifestCache(),
    });

    const manifest = await manifestProvider.loadManifest(SELECTION);
    expect(manifest.source).toBe('app-bundled-catalog');
    expect(manifestAttempts).toEqual(['sni:203.0.113.10', 'domain']);

    const plan = sdk.buildFirmwareUpdatePlan({
      manifestSnapshot: manifest.snapshot,
      manifestMode: 'external-only',
      deviceSnapshot: {
        identity: 'classic1s-e2e-device',
        model: 'classic1s',
        firmwareType: 'universal',
        currentVersions: {
          firmware: '0.0.0',
          ble: '0.0.0',
          bootloader: '0.0.0',
        },
      },
      channel: 'stable',
    }) as IFirmwareUpdatePlan;
    expect(plan.artifacts.length).toBeGreaterThan(0);
    expect(plan.artifacts.every((item) => item.container.kind === 'raw')).toBe(
      true,
    );

    const artifactRoutes: IFirmwareArtifactRoute[] = [];
    const artifactStore = {
      createLease: jest.fn(async () => 'lease-e2e'),
      downloadArtifact: jest.fn(async ({ leaseRef, requirement, route }) => {
        artifactRoutes.push(route);
        return toStoredArtifact({ leaseRef, requirement, route });
      }),
      materializeArchive: jest.fn(async () => []),
    };
    const artifactHosts = plan.artifacts.flatMap((artifact) =>
      artifact.sourceUrls.map((url) => new URL(url).hostname),
    );
    const artifactProvider = new FirmwareArtifactProvider(artifactStore, {
      now: (() => {
        let now = 2000;
        return () => {
          now += 1;
          return now;
        };
      })(),
      loadCoreSdk: async () => sdk,
      getIpTableConfig: async () => createIpTableConfig(artifactHosts),
      isProxyActiveForUrl: async () => false,
    });

    const storage = new MemoryJournalStorage();
    const journal = new FirmwareUpdateJournal({
      storage,
      now: (() => {
        let now = 3000;
        return () => {
          now += 1;
          return now;
        };
      })(),
      loadContractValidators: async () => ({
        validateUpdatePlan: sdk.validateFirmwareUpdatePlan,
        validatePreparedPlan: sdk.validatePreparedPlan,
        validateCheckpoint: sdk.validateFirmwareCheckpoint,
      }),
    });
    let binding: IFirmwareUpdateHostBinding | undefined;
    const executePreparedPlan: IFirmwareUpdateCoordinatorExecutor<{
      connectId: string;
    }> = jest.fn(async ({ preparedPlan }) => {
      expect(preparedPlan.networkPolicy).toBe('forbid');
      expect(preparedPlan.artifactReceipts).toHaveLength(plan.artifacts.length);
    });
    const releaseLease = jest.fn(async () => undefined);
    const coordinator = new FirmwareUpdateCoordinator({
      journal,
      artifactProvider,
      artifactStore: {
        createArtifactReader: () => ({
          open: async () => ({ readerId: 'reader-e2e', size: 0 }),
          read: async () => ({
            data: new ArrayBuffer(0),
            bytesRead: 0,
            eof: true,
          }),
          close: async () => undefined,
          cancel: async () => undefined,
        }),
        releaseLease,
        restorePreparedPlan: jest.fn(async () => undefined),
      },
      eligibility: {
        createUserAttestation: jest.fn(async () => ({
          backuped: true as const,
          usbConnected: true as const,
          confirmedAt: 3000,
          attestationDigest: 'e'.repeat(64),
        })),
        assertBeforeAcquisition: jest.fn(async () => undefined),
        assertBeforeDeviceMutation: jest.fn(async () => undefined),
      },
      runtimeBinding: {
        bind: jest.fn(async ({ binding: nextBinding }) => {
          binding = nextBinding;
          return {
            generation: 1,
            kind: 'direct' as const,
            token: 1,
          };
        }),
        clear: jest.fn(async () => {
          binding = undefined;
        }),
        getSnapshot: jest.fn(() => undefined),
      },
      validatePlan: async (value) => sdk.validateFirmwareUpdatePlan(value),
      validatePreparedPlan: async (value) => sdk.validatePreparedPlan(value),
      executePreparedPlan,
    });

    const prepared = await coordinator.createAndPrepare({
      transactionId: TRANSACTION_ID,
      plan,
      deviceSnapshotDigest: DEVICE_DIGEST,
      capabilityGate: {
        ready: true,
        engine: 'transaction',
        planSchemaVersion: 1,
        preparedPlanSchemaVersion: 1,
        hostBindingProtocolVersion: 1,
        checkpointSchemaVersion: 1,
        artifactProtocolVersion: 1,
        maxReadBytes: 256 * 1024,
      },
      rolloutDecision: {
        allowed: true,
        reason: 'allowed',
        source: 'signed-remote',
        policyVersion: 1,
        ruleName: 'coordinatorExternalOnly',
        cohortBucket: 1,
        engine: 'fnv1a32-v1',
      },
      confirmations: {
        backuped: true,
        usbConnected: true,
      },
      eligibilityContext: {
        connectId: 'connect-e2e',
      },
    });

    expect(prepared.phase).toBe('PREPARED');
    expect(artifactRoutes).toHaveLength(plan.artifacts.length);
    expect(artifactRoutes.every((route) => route.type === 'pinnedIp')).toBe(
      true,
    );
    const preparedJournal = await journal.read();
    expect(
      (preparedJournal?.preparedPlan as IFirmwarePreparedPlan).networkPolicy,
    ).toBe('forbid');

    const completed = await coordinator.execute({
      sessionId: TRANSACTION_ID,
      eligibilityContext: {
        connectId: 'connect-e2e',
      },
    });

    expect(completed.phase).toBe('COMPLETED');
    expect(executePreparedPlan).toHaveBeenCalledTimes(1);
    expect(binding).toBeUndefined();
    expect(releaseLease).toHaveBeenCalledWith('lease-e2e', 'completed');
  });
});
