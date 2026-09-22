import path from 'path';

import { app } from 'electron';

import { REVENUECAT_API_KEY_APPLE } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type {
  IRevenueCatAuthContext,
  IRevenueCatDesktopClient,
  IRevenueCatMethod,
  IRevenueCatRequestMap,
  IRevenueCatResultMap,
} from '@onekeyhq/shared/types/prime/revenueCat';

import { i18nText } from '../../i18n';

import {
  confirmRevenueCatIdentity,
  revenueCatIdentityChangedError,
  validateRevenueCatAuthContext,
  verifyRevenueCatIdentity,
} from './revenueCatIdentity';

import type { IVerifiedRevenueCatIdentity } from './revenueCatIdentity';

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
  apiKey: string;
  verifyIdentity: typeof verifyRevenueCatIdentity;
  confirmIdentity: typeof confirmRevenueCatIdentity;
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
      requireString(params.expectedAppUserId, 'expected app user ID');
      validateRevenueCatAuthContext(params.authContext);
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

  private binding:
    | { context: IRevenueCatAuthContext; identity: IVerifiedRevenueCatIdentity }
    | undefined;

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
        if (input.apiKey !== this.dependencies.apiKey) {
          throw new OneKeyLocalError('Unsupported RevenueCat API key');
        }
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

      if (method === 'logIn') {
        const context = { ...(input.authContext as IRevenueCatAuthContext) };
        const previousBinding = this.binding;
        this.binding = undefined;
        const identity = await this.dependencies.verifyIdentity(context);
        if (identity.userId !== input.expectedAppUserId) {
          throw revenueCatIdentityChangedError();
        }
        if (
          previousBinding?.identity.userId !== identity.userId ||
          previousBinding?.identity.email !== identity.email ||
          previousBinding?.context.endpointEnv !== context.endpointEnv
        ) {
          if (!(await this.dependencies.confirmIdentity(identity))) {
            throw Object.assign(
              new OneKeyLocalError(i18nText(ETranslations.global_cancel)),
              { userCancelled: true },
            );
          }
        }
        identity.assertCurrentSession();
        // Never forward a renderer-selected appUserId, even as an extra field.
        await nativeModule.invoke('logIn', { appUserId: identity.userId });
        identity.assertCurrentSession();
        this.binding = { context, identity };
        return undefined;
      }

      if ('expectedAppUserId' in input) {
        const binding = this.binding;
        if (!binding || binding.identity.userId !== input.expectedAppUserId) {
          throw revenueCatIdentityChangedError();
        }
        binding.identity.assertCurrentSession();
        // Revalidate inside the SDK queue, immediately before StoreKit. UI
        // eligibility checks and a previous successful login are insufficient.
        if (isTransaction) {
          const identity = await this.dependencies.verifyIdentity(
            binding.context,
          );
          if (
            identity.userId !== binding.identity.userId ||
            identity.email !== binding.identity.email
          ) {
            this.binding = undefined;
            throw revenueCatIdentityChangedError();
          }
          if (method === 'purchasePackage' && identity.isPrime) {
            throw new OneKeyLocalError(
              i18nText(ETranslations.prime_already_active__msg),
            );
          }
          binding.identity = identity;
        }
        const actualUserId = await nativeModule.invoke('getAppUserId', {});
        binding.identity.assertCurrentSession();
        if (actualUserId !== binding.identity.userId) {
          this.binding = undefined;
          throw revenueCatIdentityChangedError();
        }
      }
      if (method === 'logOut') {
        this.binding = undefined;
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
      const nativeParams: Record<string, unknown> = {};
      if (method === 'purchasePackage') {
        nativeParams.packageIdentifier = input.packageIdentifier;
        nativeParams.offeringIdentifier = input.offeringIdentifier;
      } else if (method === 'setAttributes') {
        nativeParams.attributes = input.attributes;
      } else if (method === 'checkTrialOrIntroductoryPriceEligibility') {
        nativeParams.productIdentifiers = input.productIdentifiers;
      }
      const result = await nativeModule.invoke(method, nativeParams);
      if (method === 'logOut' || method === 'setAttributes') {
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
  apiKey: REVENUECAT_API_KEY_APPLE,
  verifyIdentity: verifyRevenueCatIdentity,
  confirmIdentity: confirmRevenueCatIdentity,
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
