import {
  requireMarketAssetVariant,
  resolveMarketAssetVariant,
} from './marketAssetVariant';

import type {
  IMarketAssetDetailData,
  IMarketAssetVariant,
} from '../../types/market';

const mainnet: IMarketAssetVariant = {
  variantId: 'ethereum-mainnet',
  networkId: 'evm--1',
  tokenAddress: '',
  networkName: 'Ethereum',
  networkSymbol: 'ETH',
  networkLogoUrl: '',
  isNative: true,
  isDefault: true,
};
const base: IMarketAssetVariant = {
  ...mainnet,
  variantId: 'ethereum-base',
  networkId: 'evm--8453',
  isDefault: false,
};
const contract: IMarketAssetVariant = {
  ...mainnet,
  variantId: 'contract-base',
  networkId: 'evm--8453',
  tokenAddress: '0xAbC',
  isNative: false,
  isDefault: false,
};
const detail: Pick<IMarketAssetDetailData, 'selectedVariant' | 'variants'> = {
  selectedVariant: mainnet,
  variants: [base, contract],
};

it('uses the asset default only for entries without a selected network', () => {
  expect(
    requireMarketAssetVariant({ detail, networkId: '', tokenAddress: '' }),
  ).toBe(mainnet);
});

it('keeps the selected native network even with a placeholder address', () => {
  expect(
    requireMarketAssetVariant({
      detail,
      networkId: base.networkId,
      tokenAddress: 'native',
      isNative: true,
    }),
  ).toBe(base);
});

it('matches contracts on the selected chain using chain-aware address equality', () => {
  expect(
    requireMarketAssetVariant({
      detail,
      networkId: contract.networkId,
      tokenAddress: '0xaBc',
      isNative: false,
    }),
  ).toBe(contract);
  expect(
    resolveMarketAssetVariant({
      detail,
      networkId: mainnet.networkId,
      tokenAddress: contract.tokenAddress,
      isNative: false,
    }),
  ).toBeUndefined();
});

it.each([
  { networkId: 'evm--unavailable', tokenAddress: '', isNative: true },
  { networkId: base.networkId, tokenAddress: '', isNative: false },
  { networkId: contract.networkId, tokenAddress: '0xOther', isNative: false },
])('refuses a different default for an unmatched token: %o', (token) => {
  expect(resolveMarketAssetVariant({ detail, ...token })).toBeUndefined();
  expect(() => requireMarketAssetVariant({ detail, ...token })).toThrow(
    'does not match',
  );
});
