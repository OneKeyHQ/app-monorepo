import type { IEthereumValue } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';
import type { IToken } from '@onekeyhq/shared/types/token';

import { parseOnChainAmount } from './parseOnChainAmount';

const createToken = (isNative: boolean): IToken => ({
  address: isNative ? '' : '0x0000000000000000000000000000000000000001',
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
});
