import type { IDApp } from '@onekeyhq/shared/types/discovery';

const DEFAULT_PAYMENT_METHODS = [
  'eth_base',
  'ethereum',
  'usdc_arbitrum',
  'usdc_base',
  'usdc_erc20',
  'usdc_polygon',
  'usdc_solana',
  'usdt_arbitrum',
  'usdt_bsc',
  'usdt_erc20',
  'usdt_polygon',
  'usdt_trc20',
];

export function getBitrefillUrl(): string {
  const baseUrl = 'https://embed.bitrefill.com/';
  const params = new URLSearchParams({
    paymentMethods: DEFAULT_PAYMENT_METHODS.join(','),
  });

  return `${baseUrl}?${params.toString()}`;
}

export function getMockBitrefillDApp(): IDApp {
  return {
    dappId: 'bitrefill',
    name: 'Bitrefill',
    url: getBitrefillUrl(),
    logo: '',
    description: 'Buy gift cards & top up phones with crypto',
    networkIds: [
      'evm--1', // Ethereum
      'evm--137', // Polygon
      'evm--42161', // Arbitrum
      'evm--8453', // Base
      'evm--56', // BSC
      'sol--101', // Solana
      'tron--0x2b6653dc', // Tron
    ],
    tags: [
      {
        tagId: 'gift-cards',
        name: 'Gift Cards',
        type: 'category',
      },
    ],
  };
}
