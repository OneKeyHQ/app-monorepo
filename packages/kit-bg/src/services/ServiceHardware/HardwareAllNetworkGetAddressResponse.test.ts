import { HardwareAllNetworkGetAddressResponse } from './HardwareAllNetworkGetAddressResponse';

import type { IHwAllNetworkPrepareAccountsItem } from '../../vaults/types';

describe('HardwareAllNetworkGetAddressResponse', () => {
  const request = {
    path: "m/44'/60'/0'/0/0",
    hwSdkNetwork: 'evm' as const,
  };

  test('rejects a pending item that is absent from the completed SDK response', async () => {
    const response = new HardwareAllNetworkGetAddressResponse();
    const pendingItem = response.getItem(request);

    response.completeSdkResponse();

    await expect(pendingItem).rejects.toThrow(
      'SDK all-network response is missing requested address',
    );
  });

  test('rejects an absent item requested after the SDK response completed', async () => {
    const response = new HardwareAllNetworkGetAddressResponse();

    response.completeSdkResponse();

    await expect(response.getItem(request)).rejects.toThrow(
      'SDK all-network response is missing requested address',
    );
  });

  test('keeps a received item available after the SDK response completed', async () => {
    const response = new HardwareAllNetworkGetAddressResponse();
    const item: IHwAllNetworkPrepareAccountsItem = {
      path: request.path,
      network: request.hwSdkNetwork,
      success: true as const,
    };

    response.onSdkItemCallResponse(item);
    response.completeSdkResponse();

    await expect(response.getItem(request)).resolves.toBe(item);
  });

  test('keeps a failed item available for its network consumer', async () => {
    const response = new HardwareAllNetworkGetAddressResponse();
    const item: IHwAllNetworkPrepareAccountsItem = {
      path: request.path,
      network: request.hwSdkNetwork,
      success: false as const,
      payload: {
        code: 10_405,
        errorCode: 10_405,
        error: 'Passphrase must be entered on device',
        connectId: 'connect-id',
        deviceId: 'device-id',
      },
    };

    response.onSdkItemCallResponse(item);
    response.completeSdkResponse();

    await expect(response.getItem(request)).resolves.toBe(item);
    await expect(response.getFirstErrorItem()).resolves.toBe(item);
  });

  test('still rejects unrelated item failures', async () => {
    const response = new HardwareAllNetworkGetAddressResponse();
    const pendingItem = response.getItem(request);
    const item: IHwAllNetworkPrepareAccountsItem = {
      path: request.path,
      network: request.hwSdkNetwork,
      success: false as const,
      payload: {
        code: 99_999,
        errorCode: 99_999,
        error: 'Unrelated hardware failure',
        connectId: 'connect-id',
        deviceId: 'device-id',
      },
    };

    response.onSdkItemCallResponse(item);

    await expect(pendingItem).rejects.toMatchObject({
      payload: { error: 'Unrelated hardware failure' },
    });
  });

  test('keeps loop items pending until the callback response completes', async () => {
    const response = new HardwareAllNetworkGetAddressResponse();
    let settled = false;
    const pendingItem = response.getItem(request).finally(() => {
      settled = true;
    });

    response.onSdkResponse({ items: [], completed: false });
    await Promise.resolve();

    expect(settled).toBe(false);

    const item: IHwAllNetworkPrepareAccountsItem = {
      path: request.path,
      network: request.hwSdkNetwork,
      success: true as const,
    };
    response.onSdkResponse({ items: [item], completed: true });

    await expect(pendingItem).resolves.toBe(item);
  });
});
