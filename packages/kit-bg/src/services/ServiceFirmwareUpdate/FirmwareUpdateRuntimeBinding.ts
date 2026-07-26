import { Mutex } from 'async-mutex';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

type IHardwareCoreSdkModule = Awaited<ReturnType<typeof CoreSDKLoader>>;

export type IFirmwareUpdateHostBinding = Parameters<
  IHardwareCoreSdkModule['registerFirmwareHostBinding']
>[0];

export type EFirmwareUpdateRuntimeBindingKind = 'direct' | 'iframe-channel';

export type EFirmwareUpdateRuntimeResetReason =
  | 'binding-replaced'
  | 'iframe-recreate'
  | 'sdk-reset'
  | 'transport-switch';

export type IFirmwareUpdateRuntimeAdapter = {
  kind: EFirmwareUpdateRuntimeBindingKind;
  register: (binding: IFirmwareUpdateHostBinding) => Promise<number>;
  unregister: () => Promise<void>;
};

export type IFirmwareUpdateRuntimeBindingSnapshot = {
  generation: number;
  kind: EFirmwareUpdateRuntimeBindingKind;
  token: number;
};

type IFirmwareUpdateRuntimeBindingRequest = {
  binding: IFirmwareUpdateHostBinding;
  onBeforeGenerationChange: (
    reason: EFirmwareUpdateRuntimeResetReason,
  ) => Promise<void>;
};

export type IFirmwareUpdateRuntimeBindingDependencies = {
  getTransportType: () => Promise<EHardwareTransportType | undefined>;
  loadAdapter: (input: {
    transportType: EHardwareTransportType | undefined;
  }) => Promise<IFirmwareUpdateRuntimeAdapter>;
};

const runtimeBindingError = (message: string): OneKeyLocalError =>
  Object.assign(new OneKeyLocalError(message), {
    firmwareUpdateRuntimeBindingCode: 'RUNTIME_BINDING_UNAVAILABLE',
  });

const getDirectAdapter = ({
  register,
  unregister,
}: {
  register: (binding: IFirmwareUpdateHostBinding) => number;
  unregister: () => boolean;
}): IFirmwareUpdateRuntimeAdapter => ({
  kind: 'direct',
  register: async (binding) => register(binding),
  unregister: async () => {
    unregister();
  },
});

const loadDefaultAdapter: IFirmwareUpdateRuntimeBindingDependencies['loadAdapter'] =
  async ({ transportType }) => {
    if (platformEnv.isNative) {
      const sdk = await import('@onekeyfe/hd-ble-sdk');
      return getDirectAdapter({
        register: sdk.registerFirmwareHostBinding,
        unregister: sdk.unregisterFirmwareHostBinding,
      });
    }
    if (
      platformEnv.isDesktop &&
      (transportType === EHardwareTransportType.WEBUSB ||
        transportType === EHardwareTransportType.DesktopWebBle)
    ) {
      const sdk = await import('@onekeyfe/hd-common-connect-sdk');
      return getDirectAdapter({
        register: sdk.registerFirmwareHostBinding,
        unregister: sdk.unregisterFirmwareHostBinding,
      });
    }
    if (platformEnv.isDesktop) {
      const sdk = await import('@onekeyfe/hd-web-sdk');
      return {
        kind: 'iframe-channel',
        register: async (binding) => {
          const state = await sdk.registerFirmwareHostChannelBinding(binding);
          return state.generation;
        },
        unregister: sdk.unregisterFirmwareHostChannelBinding,
      };
    }
    throw runtimeBindingError(
      'Firmware transaction host binding is unavailable on this platform',
    );
  };

const assertGeneration = (generation: number) => {
  if (!Number.isSafeInteger(generation) || generation <= 0) {
    throw runtimeBindingError(
      'Firmware SDK returned an invalid host binding generation',
    );
  }
};

export class FirmwareUpdateRuntimeBinding {
  private readonly mutex = new Mutex();

  private readonly dependencies: IFirmwareUpdateRuntimeBindingDependencies;

  private request: IFirmwareUpdateRuntimeBindingRequest | undefined;

  private adapter: IFirmwareUpdateRuntimeAdapter | undefined;

  private snapshot: IFirmwareUpdateRuntimeBindingSnapshot | undefined;

  private activeToken: number | undefined;

  private nextToken = 0;

  constructor(dependencies: IFirmwareUpdateRuntimeBindingDependencies) {
    this.dependencies = {
      ...dependencies,
      loadAdapter: dependencies.loadAdapter ?? loadDefaultAdapter,
    };
  }

  private assertTokenCurrent(token: number) {
    if (this.activeToken !== token) {
      throw Object.assign(
        new OneKeyLocalError(
          'Firmware SDK callback belongs to a stale host binding generation',
        ),
        {
          firmwareUpdateRuntimeBindingCode: 'STALE_GENERATION',
        },
      );
    }
  }

  private createGuardedBinding({
    binding,
    token,
  }: {
    binding: IFirmwareUpdateHostBinding;
    token: number;
  }): IFirmwareUpdateHostBinding {
    return {
      artifactReader: {
        open: async (input) => {
          this.assertTokenCurrent(token);
          const result = await binding.artifactReader.open(input);
          this.assertTokenCurrent(token);
          return result;
        },
        read: async (input) => {
          this.assertTokenCurrent(token);
          const result = await binding.artifactReader.read(input);
          this.assertTokenCurrent(token);
          return result;
        },
        close: async (input) => {
          this.assertTokenCurrent(token);
          await binding.artifactReader.close(input);
          this.assertTokenCurrent(token);
        },
        cancel: async (input) => {
          this.assertTokenCurrent(token);
          await binding.artifactReader.cancel(input);
          this.assertTokenCurrent(token);
        },
      },
      checkpointSink: {
        commit: async (checkpoint) => {
          this.assertTokenCurrent(token);
          await binding.checkpointSink.commit(checkpoint);
          this.assertTokenCurrent(token);
        },
      },
      ...(binding.progressSink
        ? {
            progressSink: {
              report: async (event) => {
                this.assertTokenCurrent(token);
                await binding.progressSink?.report(event);
                this.assertTokenCurrent(token);
              },
            },
          }
        : {}),
    };
  }

  private async unregisterCurrent() {
    this.activeToken = undefined;
    this.snapshot = undefined;
    const adapter = this.adapter;
    this.adapter = undefined;
    await adapter?.unregister();
  }

  private async registerRequest(
    request: IFirmwareUpdateRuntimeBindingRequest,
  ): Promise<IFirmwareUpdateRuntimeBindingSnapshot> {
    const transportType = await this.dependencies.getTransportType();
    const adapter = await this.dependencies.loadAdapter({ transportType });
    const token = (this.nextToken += 1);
    this.activeToken = token;
    try {
      const generation = await adapter.register(
        this.createGuardedBinding({
          binding: request.binding,
          token,
        }),
      );
      assertGeneration(generation);
      this.adapter = adapter;
      this.snapshot = Object.freeze({
        generation,
        kind: adapter.kind,
        token,
      });
      return this.snapshot;
    } catch (error) {
      if (this.activeToken === token) {
        this.activeToken = undefined;
      }
      await adapter.unregister().catch(() => undefined);
      throw error;
    }
  }

  async bind(
    request: IFirmwareUpdateRuntimeBindingRequest,
  ): Promise<IFirmwareUpdateRuntimeBindingSnapshot> {
    return this.mutex.runExclusive(async () => {
      if (this.snapshot) {
        await this.request?.onBeforeGenerationChange('binding-replaced');
        await this.unregisterCurrent();
      }
      this.request = request;
      return this.registerRequest(request);
    });
  }

  async prepareForSdkReset(
    reason: Exclude<EFirmwareUpdateRuntimeResetReason, 'binding-replaced'>,
  ): Promise<void> {
    await this.mutex.runExclusive(async () => {
      if (!this.snapshot) return;
      await this.request?.onBeforeGenerationChange(reason);
      await this.unregisterCurrent();
    });
  }

  async restoreAfterSdkReset(): Promise<
    IFirmwareUpdateRuntimeBindingSnapshot | undefined
  > {
    return this.mutex.runExclusive(async () => {
      if (this.snapshot || !this.request) return this.snapshot;
      return this.registerRequest(this.request);
    });
  }

  async clear(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      this.request = undefined;
      await this.unregisterCurrent();
    });
  }

  getSnapshot(): IFirmwareUpdateRuntimeBindingSnapshot | undefined {
    return this.snapshot;
  }
}

export const createDefaultFirmwareUpdateRuntimeBinding = ({
  getTransportType,
}: Pick<
  IFirmwareUpdateRuntimeBindingDependencies,
  'getTransportType'
>): FirmwareUpdateRuntimeBinding =>
  new FirmwareUpdateRuntimeBinding({
    getTransportType,
    loadAdapter: loadDefaultAdapter,
  });
