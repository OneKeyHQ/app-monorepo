import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import ServiceLightning from '@onekeyhq/kit-bg/src/services/ServiceLightning';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { vaultFactory } from '../../../factory';
import LightningVault from '../Vault';

import ClientLightning from './ClientLightning';
import { LightningAuthorizationRequiredError } from './LightningAuthorizationRequiredError';

import type { IBroadcastTransactionParams } from '../../../types';
import type { AxiosInstance } from 'axios';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  const unchangedMethod =
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor;
  return {
    ...actual,
    backgroundClass: () => (target: unknown) => target,
    backgroundMethod: unchangedMethod,
    toastIfError: unchangedMethod,
  };
});

const networkId = 'lightning--0';
const address = 'public-lightning-test-address';
const localToken = 'synthetic-local-service-token';

function harness(accountId = 'hw-restored') {
  let credential: string | undefined;
  const getCredential = jest.fn(async () => credential);
  const exchangeToken = jest.fn(async () => {
    credential = localToken;
  });
  const getLightningAddress = jest.fn(async () => address);
  const promptPasswordVerifyByAccount = jest.fn();
  const withHardwareProcessing = jest.fn();
  const broadcastTransaction = jest.fn(async () => undefined);
  const get = jest.fn(async () => ({ data: { data: true } }));
  const post = jest.fn(async () => ({
    data: { data: { publicResult: true } },
  }));
  const backgroundApi = {
    simpleDb: { lightning: { getCredential } },
    serviceLightning: { getLightningAddress, exchangeToken },
    servicePassword: { promptPasswordVerifyByAccount },
    serviceHardwareUI: { withHardwareProcessing },
    serviceSend: { broadcastTransaction },
  };
  const client = new ClientLightning(
    backgroundApi as unknown as IBackgroundApi,
    { get, post } as unknown as AxiosInstance,
    false,
  );
  const params = { accountId, networkId };
  return {
    client,
    params,
    get,
    post,
    getCredential,
    exchangeToken,
    getLightningAddress,
    promptPasswordVerifyByAccount,
    withHardwareProcessing,
    broadcastTransaction,
    setCredential(value: string | undefined) {
      credential = value;
    },
  };
}

describe('Lightning read authorization without wallet interaction', () => {
  test.each(['hw-restored', 'hd-restored'])(
    'a restored %s reads no token without starting an authorization flow',
    async (accountId) => {
      const h = harness(accountId);
      await expect(h.client.getAuthorization(h.params)).rejects.toThrow(
        LightningAuthorizationRequiredError,
      );
      expect(h.getCredential).toHaveBeenCalledTimes(1);
      expect(h.exchangeToken).not.toHaveBeenCalled();
      expect(h.promptPasswordVerifyByAccount).not.toHaveBeenCalled();
      expect(h.withHardwareProcessing).not.toHaveBeenCalled();
      expect(h.get).not.toHaveBeenCalled();
      expect(h.post).not.toHaveBeenCalled();
    },
  );

  test('the automatic auth gate does not turn a missing local token into a signature request', async () => {
    const h = harness();
    await expect(h.client.checkAuth(h.params)).rejects.toThrow(
      LightningAuthorizationRequiredError,
    );
    expect(h.exchangeToken).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  test('automatic status and invoice reads keep auth-required errors local', async () => {
    const h = harness();
    await expect(
      h.client.specialInvoice({ ...h.params, paymentHash: 'public-test-hash' }),
    ).rejects.toThrow(LightningAuthorizationRequiredError);
    await expect(
      h.client.checkBolt11({ ...h.params, nonce: 1 }),
    ).rejects.toThrow(LightningAuthorizationRequiredError);
    expect(h.exchangeToken).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
    expect(h.post).not.toHaveBeenCalled();
  });

  test('the actual Vault history path propagates auth-required without prompting', async () => {
    const h = harness();
    const vault = Object.assign(Object.create(LightningVault.prototype), {
      getClient: jest.fn(async () => h.client),
    }) as LightningVault;
    await expect(
      vault.buildFetchHistoryListParams({
        ...h.params,
        accountAddress: address,
      } as Parameters<LightningVault['buildFetchHistoryListParams']>[0]),
    ).rejects.toThrow(LightningAuthorizationRequiredError);
    expect(h.exchangeToken).not.toHaveBeenCalled();
    expect(h.getLightningAddress).not.toHaveBeenCalled();
  });

  test('a valid local token is used without signature or registration', async () => {
    const h = harness();
    h.setCredential(localToken);
    await expect(h.client.checkAuth(h.params)).resolves.toBe(true);
    expect(h.get).toHaveBeenCalledWith(
      '/lightning/v1/account/auth/check',
      expect.objectContaining({ headers: { Authorization: localToken } }),
    );
    expect(h.exchangeToken).not.toHaveBeenCalled();
    expect(h.post).not.toHaveBeenCalled();
  });

  test('a rejected token on an automatic read does not start an interactive retry', async () => {
    const h = harness();
    h.setCredential(localToken);
    const expired = Object.assign(new OneKeyLocalError('Expired test token'), {
      code: 401,
    });
    h.get.mockRejectedValueOnce(expired);
    await expect(h.client.checkAuth(h.params)).rejects.toBe(expired);
    expect(h.get).toHaveBeenCalledTimes(1);
    expect(h.exchangeToken).not.toHaveBeenCalled();
  });

  test('storage failures cannot be mistaken for a request to sign', async () => {
    const h = harness();
    const failure = new OneKeyLocalError('Synthetic storage failure');
    h.getCredential.mockRejectedValueOnce(failure);
    await expect(h.client.getAuthorization(h.params)).rejects.toBe(failure);
    expect(h.exchangeToken).not.toHaveBeenCalled();
  });

  test('expired tokens on invoice and payment status reads never refresh interactively', async () => {
    const h = harness();
    h.setCredential(localToken);
    const expired = Object.assign(new OneKeyLocalError('Expired test token'), {
      code: 401,
    });
    h.get.mockRejectedValue(expired);
    await expect(
      h.client.specialInvoice({ ...h.params, paymentHash: 'public-test-hash' }),
    ).rejects.toBe(expired);
    await expect(h.client.checkBolt11({ ...h.params, nonce: 1 })).rejects.toBe(
      expired,
    );
    expect(h.get).toHaveBeenCalledTimes(2);
    expect(h.exchangeToken).not.toHaveBeenCalled();
  });
});

describe('explicit Lightning actions retain authorization and cancellation', () => {
  test('an explicit invoice action authorizes once then sends its request', async () => {
    const h = harness();
    await h.client.createInvoice({ ...h.params, amount: '1' });
    expect(h.exchangeToken).toHaveBeenCalledTimes(1);
    expect(h.post).toHaveBeenCalledTimes(1);
    expect(h.post).toHaveBeenCalledWith(
      '/lightning/v1/invoices/create',
      expect.objectContaining({ amount: '1' }),
      { headers: { Authorization: localToken } },
    );
  });

  test('an explicit action can refresh an expired server token', async () => {
    const h = harness();
    h.setCredential('synthetic-expired-token');
    const expired = Object.assign(new OneKeyLocalError('Expired test token'), {
      code: 50_401,
    });
    h.post.mockRejectedValueOnce(expired);
    await h.client.preCheckBolt11({
      ...h.params,
      paymentRequest: 'public-test-invoice',
      amount: '1',
    });
    expect(h.exchangeToken).toHaveBeenCalledTimes(1);
    expect(h.post).toHaveBeenCalledTimes(2);
  });

  test('cancelling explicit authorization does not retry or submit an invoice', async () => {
    const h = harness();
    const cancelled = new OneKeyLocalError('Synthetic authorization cancelled');
    h.exchangeToken.mockRejectedValueOnce(cancelled);
    await expect(
      h.client.createInvoice({ ...h.params, amount: '1' }),
    ).rejects.toBe(cancelled);
    expect(h.exchangeToken).toHaveBeenCalledTimes(1);
    expect(h.post).not.toHaveBeenCalled();
  });

  test('explicit refresh and transaction broadcast keep their existing authorization paths', async () => {
    const h = harness();
    await h.client.checkAuthWithRefresh(h.params);
    expect(h.exchangeToken).toHaveBeenCalledTimes(1);
    h.setCredential(undefined);
    await h.client.broadcastTransaction({
      ...h.params,
      accountAddress: address,
      signedTx: {
        rawTx: '{"publicTest":"transaction"}',
        txid: 'public-test-transaction-id',
        encodedTx: {},
      },
    } satisfies IBroadcastTransactionParams & { accountId: string });
    expect(h.exchangeToken).toHaveBeenCalledTimes(2);
    expect(h.broadcastTransaction).toHaveBeenCalledTimes(1);
  });

  test('the explicit service button path still verifies password and enters hardware processing', async () => {
    const exchangeToken = jest.fn(async () => undefined);
    const vault = Object.assign(Object.create(LightningVault.prototype), {
      exchangeToken,
    }) as LightningVault;
    const getVault = jest
      .spyOn(vaultFactory, 'getVault')
      .mockResolvedValueOnce(vault);
    const deviceParams = { publicTest: 'device-context' };
    const promptPasswordVerifyByAccount = jest.fn(async () => ({
      deviceParams,
    }));
    const withHardwareProcessing = jest.fn(
      async (operation: () => Promise<void>) => operation(),
    );
    const service = Object.assign(Object.create(ServiceLightning.prototype), {
      backgroundApi: {
        servicePassword: { promptPasswordVerifyByAccount },
        serviceHardwareUI: { withHardwareProcessing },
      },
    }) as ServiceLightning;
    try {
      await service.exchangeToken({ accountId: 'hw-restored', networkId });
      expect(promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);
      expect(withHardwareProcessing).toHaveBeenCalledWith(
        expect.any(Function),
        { deviceParams, debugMethodName: 'lightning.exchangeToken' },
      );
      expect(exchangeToken).toHaveBeenCalledTimes(1);
    } finally {
      getVault.mockRestore();
    }
  });

  test('cancelling the explicit service password check never enters hardware processing', async () => {
    const cancelled = new OneKeyLocalError('Synthetic authorization cancelled');
    const promptPasswordVerifyByAccount = jest.fn(async () => {
      throw cancelled;
    });
    const withHardwareProcessing = jest.fn();
    const service = Object.assign(Object.create(ServiceLightning.prototype), {
      backgroundApi: {
        servicePassword: { promptPasswordVerifyByAccount },
        serviceHardwareUI: { withHardwareProcessing },
      },
    }) as ServiceLightning;
    await expect(
      service.exchangeToken({ accountId: 'hw-restored', networkId }),
    ).rejects.toBe(cancelled);
    expect(promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);
    expect(withHardwareProcessing).not.toHaveBeenCalled();
  });
});
