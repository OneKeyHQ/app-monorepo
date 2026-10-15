import {
  printZcashShieldedHardwarePreview,
  printZcashTransparentHardwarePreview,
} from './hardwareRequestPreview';

const keys = {
  hdIndex: 3,
  ufvk: 'uview1test',
  seedFingerprintHex: 'ab'.repeat(32),
  unifiedAddress: 'u1test',
  transparentAddress: 't1test',
};

function captured(spy: jest.SpyInstance) {
  const [, json] = spy.mock.calls[0] as [string, string];
  return JSON.parse(json) as Record<string, any>;
}

describe('zcash hardware request preview', () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => spy.mockRestore());

  it('prints only the sign call and what the device must show', () => {
    const memoHex = `${Buffer.from('hi').toString('hex')}${'00'.repeat(510)}`;
    printZcashShieldedHardwarePreview({
      keys,
      unprovedPcztHex: 'aabb',
      review: {
        network: 'main',
        ufvk: keys.ufvk,
        toAddress: 'u1dest',
        amountZat: '1000',
        feeZat: '10000',
        spendSource: 'ironwood',
        isMaxSend: false,
        memoHex,
      },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const out = captured(spy);
    expect(out).toMatchObject({
      method: 'zcashSignPczt',
      params: { pczt: 'aabb' },
      deviceSeedFingerprint: keys.seedFingerprintHex,
      expectedOnScreen: { toAddress: 'u1dest', amountZat: '1000' },
    });
    expect(out.expectedOnScreen.memo.text).toBe('hi');
  });

  it('prints the transparent PCZT with the request it was built from', () => {
    printZcashTransparentHardwarePreview({
      keys,
      pcztHex: 'ccdd',
      request: {
        network: 'main',
        accountIndex: 3,
        targetHeight: 100,
        expiryHeight: 140,
        utxos: [],
        selectedOutpoints: [],
        recipients: [{ address: 't1dest', amountZat: '500' }],
        sendMax: false,
      },
    });
    const out = captured(spy);
    expect(out.params).toEqual({ pczt: 'ccdd' });
    expect(out.expectedOnScreen.recipients).toEqual([
      { address: 't1dest', amountZat: '500' },
    ]);
  });
});
