import { mayBeLocalWalletAddress } from './isLocalWalletNetwork';

// Vectors the Monero runtime's validateAddress accepts (monero-address crate
// tests and featured_addresses.json); the shape check must pass all of them.
const XMR_ACCEPTED = [
  // Standard
  '4B33mFPMq6mKi7Eiyd5XuyKRVMGVZz1Rqb9ZTyGApXW5d1aT7UBDZ89ewmnWFkzJ5wPd2SFbn313vCT8a4E2Qf4KQH4pNey',
  // Subaddress
  '8C5zHM5ud8nGC4hC2ULiBLSWx9infi8JUUmWEat4fcTf8J4H38iWYVdFmPCA9UmfLTZxD43RsyKnGEdZkoGij6csDeUnbEB',
  // Integrated
  '4Ljin4CrSNHKi7Eiyd5XuyKRVMGVZz1Rqb9ZTyGApXW5d1aT7UBDZ89ewmnWFkzJ5wPd2SFbn313vCT8a4E2Qf4KbaTH6MnpXSn88oBX35',
  // Featured
  'CjWdTpuDaZ69nTGxzm9YarR82YDYFECi1WaaREZTMy5yDsjaRX5bC3cbC3JpcrBPd7YYpjoWKuBMidgGaKBK5Jye2v3pYyUDn',
  // Featured, integrated
  'CjWdTpuDaZ69nTGxzm9YarR82YDYFECi1WaaREZTMy5yDsjaRX5bC3cbC3JpcrBPd7YYpjoWKuBMidgGaKBK5JyeeJTo4p5ayvj36PStM5AX',
];

describe('mayBeLocalWalletAddress', () => {
  it.each(XMR_ACCEPTED)('keeps a Monero address %s', async (address) => {
    await expect(
      mayBeLocalWalletAddress({ networkId: 'xmr--0', address }),
    ).resolves.toBe(true);
  });

  it.each([
    '0x52908400098527886E0F7030069857D2E4169EE7',
    'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    'vitalik.eth',
    'usdt',
    '',
  ])('rejects %s for Monero', async (address) => {
    await expect(
      mayBeLocalWalletAddress({ networkId: 'xmr--0', address }),
    ).resolves.toBe(false);
  });

  it('always validates chains that declare no address shape', async () => {
    await expect(
      mayBeLocalWalletAddress({ networkId: 'zec--0', address: 'usdt' }),
    ).resolves.toBe(true);
  });
});
