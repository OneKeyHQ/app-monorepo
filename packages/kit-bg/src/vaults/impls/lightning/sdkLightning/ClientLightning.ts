import { isAxiosError } from 'axios';

import type { IUnionMsgType } from '@onekeyhq/core/src/chains/lightning/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import {
  OneKeyLocalError,
  isRetryableLightningInvoiceDecodeFailure,
} from '@onekeyhq/shared/src/errors';
import type {
  OneKeyError,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import { LRUCache, memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { normalizeLightningInput } from '@onekeyhq/shared/src/utils/lnUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAuthResponse,
  ICreateInvoiceResponse,
  ICreateUserResponse,
  IInvoiceConfig,
  IInvoiceDecodedResponse,
  IInvoiceType,
} from '@onekeyhq/shared/types/lightning';
import type { ICheckPaymentResponse } from '@onekeyhq/shared/types/lightning/payments';
import type { IOneKeyAPIBaseResponse } from '@onekeyhq/shared/types/request';

import { LightningAuthorizationRequiredError } from './LightningAuthorizationRequiredError';

import type { IBroadcastTransactionParams } from '../../../types';
import type { AxiosInstance } from 'axios';

function isAuthError(error: unknown): boolean {
  return (
    error instanceof LightningAuthorizationRequiredError ||
    ((error as OneKeyError) &&
      ((error as OneKeyError).code === 401 ||
        (error as OneKeyError).code === 50_401))
  );
}

function invoiceDecodeCooldownMs(
  error: unknown,
  fallbackMs: number,
): number | undefined {
  if (!isRetryableLightningInvoiceDecodeFailure(error)) return undefined;
  const response = isAxiosError(error) ? error.response : undefined;
  const serverError = error as OneKeyServerApiError | undefined;
  const retryAfter =
    serverError?.retryAfter ?? response?.headers['retry-after'];
  if (typeof retryAfter !== 'string') return fallbackMs;
  const header = retryAfter.trim();
  const delay = /^\d+$/.test(header)
    ? Number(header) * 1000
    : Date.parse(header) - Date.now();
  return Number.isFinite(delay) ? Math.max(fallbackMs, delay) : fallbackMs;
}

export function createLightningInvoiceDecodeCache() {
  return {
    decoded: new LRUCache<string, Promise<IInvoiceDecodedResponse>>({
      ttl: timerUtils.getTimeDurationMs({ seconds: 30 }),
      max: 100,
    }),
    failed: new LRUCache<
      string,
      { retryAt: number; nextDelayMs: number; error: unknown }
    >({ max: 100 }),
  };
}

class ClientLightning {
  private backgroundApi: IBackgroundApi;

  private request: AxiosInstance;

  private testnet: boolean;

  readonly prefix = '/lightning/v1';

  readonly maxRetryCount = 3;

  constructor(
    backgroundApi: any,
    client: AxiosInstance,
    isTestnet: boolean,
    private readonly invoiceDecodeCache = createLightningInvoiceDecodeCache(),
  ) {
    this.request = client;
    this.testnet = isTestnet;
    this.backgroundApi = backgroundApi;
  }

  retryOperation = async <T>({
    fn,
    shouldRetry,
    onRetry,
    retryCount = 0,
    maxRetryCount = this.maxRetryCount,
    waitTime = 1000,
  }: {
    fn: () => Promise<T>;
    shouldRetry: (error: unknown) => boolean;
    onRetry: () => Promise<void>;
    retryCount?: number;
    maxRetryCount?: number;
    waitTime?: number;
  }): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (!shouldRetry(error) || retryCount >= maxRetryCount) {
        throw error;
      }

      console.log('Retrying operation due to error:', error);
      await onRetry();
      if (retryCount > 0) {
        await timerUtils.wait(waitTime);
      }

      return this.retryOperation({
        fn,
        shouldRetry,
        onRetry,
        retryCount: retryCount + 1,
        maxRetryCount,
        waitTime,
      });
    }
  };

  async getAuthorization({
    accountId,
    networkId,
    address,
  }: {
    accountId: string;
    networkId: string;
    address?: string;
  }) {
    const usedAddress =
      address ||
      (await this.backgroundApi.serviceLightning.getLightningAddress({
        accountId,
        networkId,
      }));
    const credential =
      await this.backgroundApi.simpleDb.lightning.getCredential({
        address: usedAddress,
      });
    // Account discovery, history and status reads must never prompt a restored
    // wallet to sign. Only explicit authorization or mutation retries may do so.
    if (!credential) {
      throw new LightningAuthorizationRequiredError();
    }
    return credential;
  }

  async checkAccountExist(address: string) {
    return this.request
      .get<{ data: boolean }>(`${this.prefix}/account/check`, {
        params: { address, testnet: this.testnet },
      })
      .then((i) => i.data.data);
  }

  async createUser({
    hashPubKey,
    address,
    signature,
    randomSeed,
  }: {
    hashPubKey: string;
    address: string;
    signature: string;
    randomSeed: number;
  }) {
    return this.request
      .post<ICreateUserResponse>(`${this.prefix}/account/`, {
        hashPubKey,
        address,
        signature,
        randomSeed,
        testnet: this.testnet,
      })
      .then((i) => i.data.data);
  }

  async fetchSignTemplate(
    address: string,
    signType: 'register' | 'auth' | 'transfer',
  ): Promise<IUnionMsgType> {
    return this.request
      .get<IOneKeyAPIBaseResponse<IUnionMsgType>>(
        `${this.prefix}/account/get-sign-template`,
        {
          params: { address, signType, testnet: this.testnet },
        },
      )
      .then((i) => i.data.data);
  }

  async refreshAccessToken({
    hashPubKey,
    address,
    signature,
    timestamp,
    randomSeed,
  }: {
    hashPubKey: string;
    address: string;
    signature: string;
    timestamp: number;
    randomSeed: number;
  }) {
    try {
      if (!hashPubKey || !address || !signature) {
        throw new OneKeyLocalError('Invalid exchange token params');
      }
      return await this.request
        .post<IAuthResponse>(`${this.prefix}/account/auth`, {
          hashPubKey,
          address,
          signature,
          timestamp,
          randomSeed,
          testnet: this.testnet,
        })
        .then((i) => i.data.data);
    } catch (e) {
      console.log('=====>>>exchange token failed: ', e);
      throw e;
    }
  }

  checkAuth = memoizee(
    async ({
      accountId,
      networkId,
    }: {
      accountId: string;
      networkId: string;
    }) => {
      const authorization = await this.getAuthorization({
        accountId,
        networkId,
      });
      if (!authorization) {
        throw new OneKeyLocalError('Bad Auth');
      }
      return this.request
        .get<IOneKeyAPIBaseResponse<boolean>>(
          `${this.prefix}/account/auth/check`,
          {
            params: { testnet: this.testnet },
            headers: {
              Authorization: authorization,
            },
          },
        )
        .then((i) => i.data.data);
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
    },
  );

  async checkAuthWithRefresh(params: { accountId: string; networkId: string }) {
    return this.retryOperation({
      fn: async () => {
        await this.checkAuth(params);
      },
      shouldRetry: isAuthError,
      onRetry: async () => {
        await this.backgroundApi.serviceLightning.exchangeToken(params);
        // A rejected memoized check is removed asynchronously. Invalidate it
        // now so this explicit retry cannot request a second authorization.
        await this.checkAuth.delete(params);
      },
    });
  }

  getConfig = memoizee(
    async () =>
      this.request
        .get<IOneKeyAPIBaseResponse<IInvoiceConfig>>(
          `${this.prefix}/invoices/config`,
          {
            params: { testnet: this.testnet },
          },
        )
        .then((i) => i.data.data),
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 60 }),
    },
  );

  async createInvoice({
    accountId,
    networkId,
    amount,
    description,
  }: {
    accountId: string;
    networkId: string;
    amount: string;
    description?: string;
  }): Promise<ICreateInvoiceResponse['data']> {
    return this.retryOperation({
      fn: async () => {
        const res = await this.request.post<ICreateInvoiceResponse>(
          `${this.prefix}/invoices/create`,
          {
            amount,
            description: description || 'OneKey Invoice',
            testnet: this.testnet,
          },
          {
            headers: {
              Authorization: await this.getAuthorization({
                accountId,
                networkId,
              }),
            },
          },
        );
        return res.data.data;
      },
      shouldRetry: isAuthError,
      onRetry: async () => {
        await this.backgroundApi.serviceLightning.exchangeToken({
          accountId,
          networkId,
        });
      },
    });
  }

  async decodedInvoice(input: string) {
    const invoice = normalizeLightningInput(input);
    const { decoded, failed } = this.invoiceDecodeCache;
    const previousFailure = failed.get(invoice);
    if (previousFailure && Date.now() < previousFailure.retryAt) {
      throw previousFailure.error;
    }
    const cached = decoded.get(invoice);
    if (cached) {
      return cached;
    }
    const pending = this.request
      .get<IOneKeyAPIBaseResponse<IInvoiceDecodedResponse>>(
        `${this.prefix}/invoices/decode/${invoice}`,
      )
      .then(({ data }) => {
        if (previousFailure && failed.get(invoice) === previousFailure) {
          failed.delete(invoice);
        }
        return data.data;
      })
      .catch((error: unknown) => {
        if (decoded.get(invoice) === pending) {
          const fallbackMs = previousFailure?.nextDelayMs ?? 1000;
          const cooldown = invoiceDecodeCooldownMs(error, fallbackMs);
          if (cooldown !== undefined) {
            failed.set(invoice, {
              retryAt: Date.now() + cooldown,
              nextDelayMs: Math.min(30_000, fallbackMs * 2),
              error,
            });
          } else if (previousFailure) {
            failed.delete(invoice);
          }
          decoded.delete(invoice);
        }
        throw error;
      });
    decoded.set(invoice, pending);
    return pending;
  }

  specialInvoice = memoizee(
    async ({
      accountId,
      networkId,
      paymentHash,
    }: {
      accountId: string;
      networkId: string;
      paymentHash: string;
    }) =>
      this.request
        .get<IOneKeyAPIBaseResponse<IInvoiceType>>(
          `${this.prefix}/invoices/${paymentHash}`,
          {
            params: {
              testnet: this.testnet,
            },
            headers: {
              Authorization: await this.getAuthorization({
                accountId,
                networkId,
              }),
            },
          },
        )
        .then((i) => i.data.data),
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 1 }),
    },
  );

  async preCheckBolt11({
    accountId,
    networkId,
    paymentRequest,
    amount,
  }: {
    accountId: string;
    networkId: string;
    paymentRequest: string;
    amount: string;
  }) {
    return this.retryOperation({
      fn: async () => {
        const res = await this.request.post<{
          data: {
            result: 'OK';
          };
        }>(
          `${this.prefix}/payments/prepay-check`,
          {
            paymentRequest,
            amount,
            testnet: this.testnet,
          },
          {
            headers: {
              Authorization: await this.getAuthorization({
                accountId,
                networkId,
              }),
            },
          },
        );
        return res.data.data;
      },
      shouldRetry: isAuthError,
      onRetry: async () => {
        await this.backgroundApi.serviceLightning.exchangeToken({
          accountId,
          networkId,
        });
      },
    });
  }

  async checkBolt11({
    accountId,
    networkId,
    nonce,
  }: {
    accountId: string;
    networkId: string;
    nonce: number;
  }) {
    return this.request
      .get<IOneKeyAPIBaseResponse<ICheckPaymentResponse>>(
        `${this.prefix}/payments/check-bolt11`,
        {
          params: { nonce, testnet: this.testnet },
          headers: {
            Authorization: await this.getAuthorization({
              accountId,
              networkId,
            }),
          },
        },
      )
      .then((i) => i.data.data);
  }

  async broadcastTransaction(
    params: IBroadcastTransactionParams & { accountId: string },
  ) {
    return this.retryOperation({
      fn: async () => {
        const { signedTx, accountId, networkId, accountAddress } = params;
        console.log('broadcastTransaction START:', {
          rawTx: signedTx.rawTx,
        });
        const sign = await this.getAuthorization({
          networkId,
          accountId,
        });
        const rawTx = JSON.parse(signedTx.rawTx);
        const newRawTx = { ...rawTx, sign };
        const newSignedTx = { ...signedTx, rawTx: JSON.stringify(newRawTx) };
        await this.backgroundApi.serviceSend.broadcastTransaction({
          accountId,
          networkId,
          accountAddress,
          signedTx: newSignedTx,
        });
      },
      shouldRetry: (e) => {
        if (isAuthError(e)) return true;
        const error = e as OneKeyServerApiError;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return error.data?.data?.code === 50_401;
      },
      onRetry: async () => {
        await this.backgroundApi.serviceLightning.exchangeToken(params);
      },
    });
  }
}

export default ClientLightning;
