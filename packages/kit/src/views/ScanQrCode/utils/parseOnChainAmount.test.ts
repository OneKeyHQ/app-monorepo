import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { parseQRCode } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode';
import type { IEthereumValue } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';
import type { IToken } from '@onekeyhq/shared/types/token';

import { parseOnChainAmount } from './parseOnChainAmount';

const QA_ERC681_TOKEN_TRANSFER_CONFLICTING_AMOUNT_URI =
  'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48@1/transfer?address=0x178e3e6c9f547A00E33150F7104427ea02cfc747&uint256=1000000&value=999000000';

const mockBackgroundApi = {
  serviceNetwork: {
    getNetworksByImpls: async () => ({
      networks: [{ chainId: '1', id: 'evm--1' }],
    }),
  },
} as unknown as IBackgroundApi;

const createToken = (
  isNative: boolean | undefined,
  address?: string,
): IToken => ({
  address: isNative
    ? ''
    : address || '0x0000000000000000000000000000000000000001',
  decimals: isNative ? 18 : 6,
  isNative,
  name: isNative ? 'Ether' : 'USD Coin',
  symbol: isNative ? 'ETH' : 'USDC',
});

const createEthereumValue = (
  value: Partial<IEthereumValue>,
): {
  type: EQRCodeHandlerType;
  data: IEthereumValue;
} => ({
  type: EQRCodeHandlerType.ETHEREUM,
  data: {
    address: '0x0000000000000000000000000000000000000002',
    id: '1',
    network: { id: 'evm--1' } as IEthereumValue['network'],
    ...value,
  },
});

describe('parseOnChainAmount', () => {
  it('uses uint256 instead of value for ERC-681 token transfers', async () => {
    await expect(
      parseOnChainAmount(
        createEthereumValue({
          functionName: 'transfer',
          tokenAddress: '0x0000000000000000000000000000000000000001',
          uint256: '1000000',
          value: '999000000',
        }),
        createToken(false),
      ),
    ).resolves.toBe('1');
  });

  it('uses the QR reproduction URI amount from uint256 instead of value', async () => {
    const result = await parseQRCode(
      QA_ERC681_TOKEN_TRANSFER_CONFLICTING_AMOUNT_URI,
      {
        backgroundApi: mockBackgroundApi,
      },
    );

    expect(result.type).toBe(EQRCodeHandlerType.ETHEREUM);

    await expect(
      parseOnChainAmount(
        result,
        createToken(false, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
      ),
    ).resolves.toBe('1');
  });

  it('uses uint256 for non-native token links without a transfer function', async () => {
    await expect(
      parseOnChainAmount(
        createEthereumValue({
          tokenAddress: '0x0000000000000000000000000000000000000001',
          uint256: '1000000',
          value: '999000000',
        }),
        createToken(false),
      ),
    ).resolves.toBe('1');
  });

  it('uses uint256 instead of amount for non-native tokens', async () => {
    await expect(
      parseOnChainAmount(
        createEthereumValue({
          amount: '999',
          functionName: 'transfer',
          tokenAddress: '0x0000000000000000000000000000000000000001',
          uint256: '1000000',
        }),
        createToken(false),
      ),
    ).resolves.toBe('1');
  });

  it('ignores value and amount for non-native tokens without uint256', async () => {
    await expect(
      parseOnChainAmount(
        createEthereumValue({
          amount: '999',
          tokenAddress: '0x0000000000000000000000000000000000000001',
          value: '999000000',
        }),
        createToken(false),
      ),
    ).resolves.toBe('');
  });

  it('keeps value handling when token isNative is unknown', async () => {
    await expect(
      parseOnChainAmount(
        createEthereumValue({
          value: '999000000',
        }),
        createToken(undefined),
      ),
    ).resolves.toBe('999');
  });

  it('keeps value handling for native EIP-681 transfers', async () => {
    await expect(
      parseOnChainAmount(
        createEthereumValue({
          value: '1000000000000000000',
        }),
        createToken(true),
      ),
    ).resolves.toBe('1');
  });

  it('does not use uint256 as a native token amount', async () => {
    await expect(
      parseOnChainAmount(
        createEthereumValue({
          uint256: '1000000000000000000',
        }),
        createToken(true),
      ),
    ).resolves.toBe('');
  });
});
