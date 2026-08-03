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
});
