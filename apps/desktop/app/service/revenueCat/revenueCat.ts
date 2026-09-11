import path from 'path';

import { app } from 'electron';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IRevenueCatDesktopClient,
  IRevenueCatMethod,
  IRevenueCatRequestMap,
  IRevenueCatResultMap,
} from '@onekeyhq/shared/types/prime/revenueCat';

interface IRevenueCatNativeModule {
  isAvailable?: () => boolean;
  invoke(
    method: IRevenueCatMethod,
    params: Record<string, unknown>,
  ): Promise<unknown>;
}

type IRevenueCatDependencies = {
  isMacAppStore: () => boolean;
  loadNativeModule: () => IRevenueCatNativeModule;
};

function requireString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 1024) {
    throw new OneKeyLocalError(`Invalid RevenueCat ${name}`);
  }
}

function validateRequest(
  method: IRevenueCatMethod,
  params: Record<string, unknown>,
) {
  switch (method) {
    case 'configure':
      requireString(params.apiKey, 'API key');
      break;
    case 'logIn':
      requireString(params.appUserId, 'app user ID');
      break;
    case 'purchasePackage':
      requireString(params.packageIdentifier, 'package identifier');
      requireString(params.offeringIdentifier, 'offering identifier');
      requireString(params.expectedAppUserId, 'expected app user ID');
      break;
    case 'restorePurchases':
    case 'getCustomerInfo':
      requireString(params.expectedAppUserId, 'expected app user ID');
      break;
    case 'setAttributes': {
      requireString(params.expectedAppUserId, 'expected app user ID');
      if (
        !params.attributes ||
        typeof params.attributes !== 'object' ||
        Array.isArray(params.attributes)
      ) {
        throw new OneKeyLocalError('Invalid RevenueCat attributes');
      }
      const allowedAttributes = new Set([
        '$mixpanelDistinctId',
        '$posthogUserId',
      ]);
      for (const [key, value] of Object.entries(params.attributes)) {
        if (!allowedAttributes.has(key)) {
          throw new OneKeyLocalError(
            'Unsupported RevenueCat subscriber attribute',
          );
        }
        requireString(value, 'subscriber attribute');
      }
      break;
    }
    case 'checkTrialOrIntroductoryPriceEligibility':
      if (
        !Array.isArray(params.productIdentifiers) ||
        params.productIdentifiers.length > 100
      ) {
        throw new OneKeyLocalError('Invalid RevenueCat product identifiers');
      }
      params.productIdentifiers.forEach((value: unknown) =>
        requireString(value, 'product identifier'),
      );
      break;
    case 'logOut':
    case 'getAppUserId':
    case 'getOfferings':
      break;
    default:
      throw new OneKeyLocalError('Unsupported RevenueCat method');
  }
}

function toIpcError(error: unknown): Error {
  const details =
    error && typeof error === 'object'
      ? (error as {
          message?: unknown;
          code?: unknown;
          userCancelled?: unknown;
        })
      : undefined;
  let code: number | undefined;
  if (typeof details?.code === 'number') {
    code = details.code;
  } else if (typeof details?.code === 'string' && /^\d+$/.test(details.code)) {
    code = Number(details.code);
  }
  // Electron only transports Error.message. Preserve the SDK cancellation
  // marker in the existing IPC error envelope instead of logging purchase data.
  return new Error(
    JSON.stringify({
      message:
        typeof details?.message === 'string'
          ? details.message
          : 'RevenueCat request failed',
      code,
      data: {
        revenueCat: true,
        userCancelled: details?.userCancelled === true || code === 1,
      },
    }),
  );
}

export class RevenueCatDesktopClient implements IRevenueCatDesktopClient {
  private nativeModule: IRevenueCatNativeModule | undefined;

  private configuredApiKey: string | undefined;

  private queue: Promise<unknown> = Promise.resolve();

  private transactionPending = false;

  constructor(private readonly dependencies: IRevenueCatDependencies) {}

  private getNativeModule(): IRevenueCatNativeModule {
    if (!this.dependencies.isMacAppStore()) {
      throw new OneKeyLocalError(
        'Apple purchases are only available in the Mac App Store app',
      );
    }
    this.nativeModule ??= this.dependencies.loadNativeModule();
    return this.nativeModule;
  }

  isAvailable(): boolean {
    try {
      const nativeModule = this.getNativeModule();
      return (
        typeof nativeModule.invoke === 'function' &&
        (nativeModule.isAvailable?.() ?? true)
      );
    } catch {
      return false;
    }
  }

  async invoke<K extends IRevenueCatMethod>(
    method: K,
    params: IRevenueCatRequestMap[K],
  ): Promise<IRevenueCatResultMap[K]> {
    const isTransaction =
      method === 'purchasePackage' || method === 'restorePurchases';
    if (isTransaction && this.transactionPending) {
      throw toIpcError(
        new Error('A purchase or restore is already in progress'),
      );
    }
    if (isTransaction) this.transactionPending = true;
    const request = this.queue.then(async () => {
      const input = (params ?? {}) as Record<string, unknown>;
      validateRequest(method, input);
      const nativeModule = this.getNativeModule();
      if (method === 'configure') {
        if (this.configuredApiKey && this.configuredApiKey !== input.apiKey) {
          throw new OneKeyLocalError(
            'RevenueCat is already configured with a different API key',
          );
        }
        if (!this.configuredApiKey) {
          await nativeModule.invoke('configure', { apiKey: input.apiKey });
          this.configuredApiKey = input.apiKey as string;
        }
        return undefined;
      }
      if (method === 'logOut' && !this.configuredApiKey) return undefined;
      if (!this.configuredApiKey)
        throw new OneKeyLocalError('RevenueCat is not configured');

      if ('expectedAppUserId' in input) {
        const actualUserId = await nativeModule.invoke('getAppUserId', {});
        if (actualUserId !== input.expectedAppUserId) {
          throw new OneKeyLocalError(
            'RevenueCat app user ID changed before the request',
          );
        }
      }
      if (method === 'logOut') {
        const userId = await nativeModule.invoke('getAppUserId', {});
        if (
          typeof userId === 'string' &&
          userId.startsWith('$RCAnonymousID:')
        ) {
          return undefined;
        }
      }
      // Only RevenueCat owns StoreKit transactions. The renderer sends package
      // identifiers; the native SDK resolves the actual offering and product.
      const { expectedAppUserId: _expectedAppUserId, ...nativeParams } = input;
      const result = await nativeModule.invoke(method, nativeParams);
      if (
        method === 'logIn' ||
        method === 'logOut' ||
        method === 'setAttributes'
      ) {
        return undefined;
      }
      return result;
    });
    this.queue = request.catch(() => undefined);
    try {
      return (await request) as IRevenueCatResultMap[K];
    } catch (error) {
      throw toIpcError(error);
    } finally {
      if (isTransaction) this.transactionPending = false;
    }
  }
}

const revenueCatDesktopClient = new RevenueCatDesktopClient({
  isMacAppStore: () => process.platform === 'darwin' && Boolean(process.mas),
  loadNativeModule: () => {
    const modulePath = app.isPackaged
      ? path.join(process.resourcesPath, 'revenuecat', 'index.js')
      : path.join(
          __dirname,
          '..',
          '..',
          'native-modules',
          'revenuecat-macos',
          'build',
          'universal',
          'index.js',
        );
    // Runtime path keeps macOS binaries out of the JS bundle and other targets.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require(modulePath) as IRevenueCatNativeModule;
  },
});

export default revenueCatDesktopClient;
