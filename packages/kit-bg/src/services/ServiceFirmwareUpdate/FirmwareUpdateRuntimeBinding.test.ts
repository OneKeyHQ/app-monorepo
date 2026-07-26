import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  FirmwareUpdateRuntimeBinding,
  type IFirmwareUpdateHostBinding,
  type IFirmwareUpdateRuntimeAdapter,
} from './FirmwareUpdateRuntimeBinding';

import type { IFirmwareCheckpoint } from './firmwareUpdateCoordinatorTypes';

const CHECKPOINT: IFirmwareCheckpoint = {
  schemaVersion: 1,
  transactionId: 'transaction-1',
  planDigest: 'a'.repeat(64),
  sequence: 0,
  state: 'PREPARED',
  timestampMs: 1_721_862_400_000,
};

const createAdapter = ({
  kind = 'direct',
}: {
  kind?: IFirmwareUpdateRuntimeAdapter['kind'];
} = {}) => {
  let generation = 0;
  let currentBinding: IFirmwareUpdateHostBinding | undefined;
  const events: string[] = [];
  const adapter: IFirmwareUpdateRuntimeAdapter = {
    kind,
    register: async (binding) => {
      generation += 1;
      currentBinding = binding;
      events.push(`register:${generation}`);
      return generation;
    },
    unregister: async () => {
      events.push('unregister');
      currentBinding = undefined;
    },
  };
  return {
    adapter,
    events,
    getBinding: () => currentBinding,
  };
};

const createHostBinding = ({
  checkpoints,
}: {
  checkpoints: IFirmwareCheckpoint[];
}): IFirmwareUpdateHostBinding => ({
  artifactReader: {
    open: async () => ({
      readerId: 'reader-1',
      size: 8,
    }),
    read: async () => ({
      data: new ArrayBuffer(4),
      bytesRead: 4,
      eof: false,
    }),
    close: async () => undefined,
    cancel: async () => undefined,
  },
  checkpointSink: {
    commit: async (value) => {
      checkpoints.push(value);
    },
  },
  progressSink: {
    report: async () => undefined,
  },
});

describe('FirmwareUpdateRuntimeBinding', () => {
  it.each(['direct', 'iframe-channel'] as const)(
    'binds and exposes the current %s generation',
    async (kind) => {
      const fake = createAdapter({ kind });
      const runtimeBinding = new FirmwareUpdateRuntimeBinding({
        getTransportType: async () => undefined,
        loadAdapter: async () => fake.adapter,
      });
      const checkpoints: IFirmwareCheckpoint[] = [];

      const snapshot = await runtimeBinding.bind({
        binding: createHostBinding({ checkpoints }),
        onBeforeGenerationChange: async () => undefined,
      });
      await fake.getBinding()?.checkpointSink.commit(CHECKPOINT);

      expect(snapshot).toEqual({
        generation: 1,
        kind,
        token: 1,
      });
      expect(runtimeBinding.getSnapshot()).toEqual(snapshot);
      expect(checkpoints).toEqual([CHECKPOINT]);
    },
  );

  it('pauses before reset, rejects stale callbacks, then rebinds', async () => {
    const fake = createAdapter();
    const runtimeBinding = new FirmwareUpdateRuntimeBinding({
      getTransportType: async () => undefined,
      loadAdapter: async () => fake.adapter,
    });
    const events = fake.events;
    const checkpoints: IFirmwareCheckpoint[] = [];
    await runtimeBinding.bind({
      binding: createHostBinding({ checkpoints }),
      onBeforeGenerationChange: async (reason) => {
        events.push(`pause:${reason}`);
      },
    });
    const staleBinding = fake.getBinding();

    await runtimeBinding.prepareForSdkReset('transport-switch');
    await expect(
      staleBinding?.checkpointSink.commit(CHECKPOINT),
    ).rejects.toMatchObject({
      firmwareUpdateRuntimeBindingCode: 'STALE_GENERATION',
    });
    const restored = await runtimeBinding.restoreAfterSdkReset();

    expect(events).toEqual([
      'register:1',
      'pause:transport-switch',
      'unregister',
      'register:2',
    ]);
    expect(restored?.generation).toBe(2);
  });

  it('fails closed when the pre-reset checkpoint cannot be committed', async () => {
    const fake = createAdapter();
    const runtimeBinding = new FirmwareUpdateRuntimeBinding({
      getTransportType: async () => undefined,
      loadAdapter: async () => fake.adapter,
    });
    await runtimeBinding.bind({
      binding: createHostBinding({ checkpoints: [] }),
      onBeforeGenerationChange: async () => {
        throw new OneKeyLocalError('checkpoint storage failed');
      },
    });

    await expect(
      runtimeBinding.prepareForSdkReset('sdk-reset'),
    ).rejects.toThrow('checkpoint storage failed');
    expect(fake.events).toEqual(['register:1']);
    expect(runtimeBinding.getSnapshot()?.generation).toBe(1);
  });

  it('serializes binding replacements and invalidates the old generation', async () => {
    const fake = createAdapter();
    const runtimeBinding = new FirmwareUpdateRuntimeBinding({
      getTransportType: async () => undefined,
      loadAdapter: async () => fake.adapter,
    });
    const oldCheckpoints: IFirmwareCheckpoint[] = [];
    const newCheckpoints: IFirmwareCheckpoint[] = [];
    await runtimeBinding.bind({
      binding: createHostBinding({ checkpoints: oldCheckpoints }),
      onBeforeGenerationChange: async (reason) => {
        fake.events.push(`pause:${reason}`);
      },
    });
    const staleBinding = fake.getBinding();

    const replacement = await runtimeBinding.bind({
      binding: createHostBinding({ checkpoints: newCheckpoints }),
      onBeforeGenerationChange: async () => undefined,
    });
    await expect(
      staleBinding?.checkpointSink.commit(CHECKPOINT),
    ).rejects.toMatchObject({
      firmwareUpdateRuntimeBindingCode: 'STALE_GENERATION',
    });
    await fake.getBinding()?.checkpointSink.commit(CHECKPOINT);

    expect(fake.events).toEqual([
      'register:1',
      'pause:binding-replaced',
      'unregister',
      'register:2',
    ]);
    expect(replacement.generation).toBe(2);
    expect(oldCheckpoints).toEqual([]);
    expect(newCheckpoints).toEqual([CHECKPOINT]);
  });
});
