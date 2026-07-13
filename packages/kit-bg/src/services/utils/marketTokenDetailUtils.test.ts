import { resolveMarketTokenDetailRequestTokenAddress } from './marketTokenDetailUtils';

describe('marketTokenDetailUtils', () => {
  test('keeps contract token address without resolving native token address', async () => {
    const getNativeTokenAddress = jest.fn(async () => '0x2::sui::SUI');

    await expect(
      resolveMarketTokenDetailRequestTokenAddress({
        tokenAddress: '0xabc',
        networkId: 'sui--mainnet',
        getNativeTokenAddress,
      }),
    ).resolves.toBe('0xabc');

    expect(getNativeTokenAddress).not.toHaveBeenCalled();
  });

  test('resolves empty native token address before token detail request', async () => {
    const getNativeTokenAddress = jest.fn(async () => '0x2::sui::SUI');

    await expect(
      resolveMarketTokenDetailRequestTokenAddress({
        tokenAddress: '',
        networkId: 'sui--mainnet',
        getNativeTokenAddress,
      }),
    ).resolves.toBe('0x2::sui::SUI');

    expect(getNativeTokenAddress).toHaveBeenCalledWith({
      networkId: 'sui--mainnet',
    });
  });

  test('keeps empty address when a network does not define native token address', async () => {
    const getNativeTokenAddress = jest.fn(async () => '');

    await expect(
      resolveMarketTokenDetailRequestTokenAddress({
        tokenAddress: '',
        networkId: 'evm--1',
        getNativeTokenAddress,
      }),
    ).resolves.toBe('');
  });
});
