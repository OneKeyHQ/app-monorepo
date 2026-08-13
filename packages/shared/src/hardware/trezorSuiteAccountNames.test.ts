import { parseTrezorSuiteAccountNames } from './trezorSuiteAccountNames';

describe('parseTrezorSuiteAccountNames', () => {
  it('returns one cached receive address per Trezor Suite BTC account and extracts deviceId', () => {
    expect(
      parseTrezorSuiteAccountNames([
        {
          deviceState: 'wallet-descriptor@32555577C40F82E0126EEDA3:1',
          symbol: 'btc',
          index: 0,
          accountType: 'normal',
          path: "m/84'/0'/0'",
          visible: true,
          address: 'bc1qe4a5fs630huxjhjtgtxdevqlq39yaepy9ad698',
          addressPath: "m/84'/0'/0'/0/0",
        },
        {
          deviceState: 'wallet-descriptor@32555577C40F82E0126EEDA3:1',
          symbol: 'btc',
          index: 1,
          accountType: 'taproot',
          path: "m/86'/0'/1'",
          visible: true,
          address:
            'bc1pywjr3dpauzdlm46w33v8mrfzgggh2gnydewzptqhxjcwsdvs4h2q96x90r',
          addressPath: "m/86'/0'/1'/0/0",
        },
      ]),
    ).toEqual({
      status: 'available',
      accounts: [
        {
          deviceId: '32555577C40F82E0126EEDA3',
          name: 'Bitcoin #1',
          address: 'bc1qe4a5fs630huxjhjtgtxdevqlq39yaepy9ad698',
          path: "m/84'/0'/0'/0/0",
          accountType: 'normal',
          visible: true,
        },
        {
          deviceId: '32555577C40F82E0126EEDA3',
          name: 'Bitcoin #2',
          address:
            'bc1pywjr3dpauzdlm46w33v8mrfzgggh2gnydewzptqhxjcwsdvs4h2q96x90r',
          path: "m/86'/0'/1'/0/0",
          accountType: 'taproot',
          visible: true,
        },
      ],
    });
  });

  it('drops non-BTC, malformed and address-less source records', () => {
    expect(
      parseTrezorSuiteAccountNames([
        {
          deviceState: 'wallet@DEVICE:1',
          symbol: 'eth',
          index: 0,
          path: "m/44'/60'/0'/0/0",
          address: '0x1111111111111111111111111111111111111111',
        },
        {
          deviceState: 'not-a-static-session-id',
          symbol: 'btc',
          index: 0,
          path: "m/84'/0'/0'",
          address: 'bc1qe4a5fs630huxjhjtgtxdevqlq39yaepy9ad698',
          addressPath: "m/84'/0'/0'/0/0",
        },
        {
          deviceState: 'wallet@DEVICE:1',
          symbol: 'btc',
          index: 0,
          path: "m/84'/0'/0'",
        },
      ]),
    ).toEqual({ status: 'no_accounts', accounts: [] });
  });
});

describe('parseTrezorSuiteAccountNames custom labels', () => {
  const base = {
    symbol: 'btc',
    deviceState: 'sess@9DD7EB93C7539862BA318907:1',
    address: 'bc1qcj6kf4d62sp373ex3l3fhrrs9kmjq5h6fgytdt',
    addressPath: "m/84'/0'/0'/0/0",
    index: 0,
    accountType: 'normal',
  };

  it('prefers a decrypted label over the index-derived title', () => {
    const result = parseTrezorSuiteAccountNames([
      { ...base, accountLabel: "Bitcoin a'a'a#1" },
    ]);
    expect(result.status).toBe('available');
    expect(result.accounts[0].name).toBe("Bitcoin a'a'a#1");
  });

  it('falls back to the generated title when no label is present', () => {
    expect(parseTrezorSuiteAccountNames([base]).accounts[0].name).toBe(
      'Bitcoin #1',
    );
  });

  it('ignores blank and oversized labels', () => {
    expect(
      parseTrezorSuiteAccountNames([{ ...base, accountLabel: '   ' }])
        .accounts[0].name,
    ).toBe('Bitcoin #1');
    expect(
      parseTrezorSuiteAccountNames([{ ...base, accountLabel: 'a'.repeat(81) }])
        .accounts[0].name,
    ).toBe('Bitcoin #1');
  });
});
