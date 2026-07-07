import {
  HOME_WALLET_TAB_SUPPORT_INIT,
  buildHomeWalletTabSupport,
  hasDeFiSupportedEnabledNetwork,
  resolveHomeWalletTabSupport,
} from './homeWalletTabSupportUtils';

const allNetworksState = {
  enabledNetworks: {},
  disabledNetworks: {},
};

const makeNetwork = (
  id: string,
  overrides?: { isAllNetworks?: boolean; isTestnet?: boolean },
) => ({
  id,
  isAllNetworks: overrides?.isAllNetworks,
  isTestnet: overrides?.isTestnet ?? false,
});

describe('Home wallet tab support', () => {
  it('supports DeFi and Perps on a supported single network', () => {
    expect(
      buildHomeWalletTabSupport({
        network: makeNetwork('evm--1'),
        deFiEnabledNetworksMap: { 'evm--1': true },
        perpDisabled: false,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    });
  });

  it('hides DeFi and Perps on an unsupported single network', () => {
    expect(
      buildHomeWalletTabSupport({
        network: makeNetwork('btc--0'),
        deFiEnabledNetworksMap: { 'evm--1': true },
        perpDisabled: false,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: false,
      isPerpsSupported: false,
    });
  });

  it('shows All Networks tabs when at least one enabled network supports DeFi', () => {
    expect(
      buildHomeWalletTabSupport({
        network: makeNetwork('onekeyall--0', { isAllNetworks: true }),
        allNetworks: [makeNetwork('btc--0'), makeNetwork('evm--1')],
        allNetworksState,
        deFiEnabledNetworksMap: { 'evm--1': true },
        perpDisabled: false,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    });
  });

  it('hides All Networks tabs when no enabled network supports DeFi', () => {
    expect(
      buildHomeWalletTabSupport({
        network: makeNetwork('onekeyall--0', { isAllNetworks: true }),
        allNetworks: [makeNetwork('btc--0')],
        allNetworksState,
        deFiEnabledNetworksMap: { 'evm--1': true },
        perpDisabled: false,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: false,
      isPerpsSupported: false,
    });
  });

  it('does not count a disabled supported network in All Networks', () => {
    expect(
      hasDeFiSupportedEnabledNetwork({
        allNetworks: [makeNetwork('evm--1')],
        allNetworksState: {
          enabledNetworks: {},
          disabledNetworks: { 'evm--1': true },
        },
        deFiEnabledNetworksMap: { 'evm--1': true },
      }),
    ).toBe(false);
  });

  it('counts supported custom networks only when explicitly enabled', () => {
    const customNetwork = makeNetwork('evm--999999');
    expect(
      hasDeFiSupportedEnabledNetwork({
        allNetworks: [customNetwork],
        allNetworksState,
        deFiEnabledNetworksMap: { 'evm--999999': true },
      }),
    ).toBe(false);

    expect(
      hasDeFiSupportedEnabledNetwork({
        allNetworks: [customNetwork],
        allNetworksState: {
          enabledNetworks: { 'evm--999999': true },
          disabledNetworks: {},
        },
        deFiEnabledNetworksMap: { 'evm--999999': true },
      }),
    ).toBe(true);
  });

  it('keeps Perps hidden when Perps is globally disabled', () => {
    expect(
      buildHomeWalletTabSupport({
        network: makeNetwork('evm--1'),
        deFiEnabledNetworksMap: { 'evm--1': true },
        perpDisabled: true,
      }),
    ).toEqual({
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: false,
    });
  });

  it('falls back to init before the first support result is ready', () => {
    expect(
      resolveHomeWalletTabSupport({
        result: undefined,
        scopeKey: 'evm--1:single:perp-enabled:0',
        lastReadyResult: undefined,
      }),
    ).toEqual(HOME_WALLET_TAB_SUPPORT_INIT);
  });

  it('keeps the last ready support while a new scope is refreshing', () => {
    expect(
      resolveHomeWalletTabSupport({
        result: undefined,
        scopeKey: 'onekeyall--0:all:perp-enabled:1',
        lastReadyResult: {
          scopeKey: 'onekeyall--0:all:perp-enabled:0',
          isReady: true,
          isDeFiSupported: true,
          isPerpsSupported: true,
        },
      }),
    ).toEqual({
      scopeKey: 'onekeyall--0:all:perp-enabled:0',
      isReady: true,
      isDeFiSupported: true,
      isPerpsSupported: true,
    });
  });

  it('uses the current scoped support once the refresh resolves', () => {
    expect(
      resolveHomeWalletTabSupport({
        result: {
          scopeKey: 'btc--0:single:perp-enabled:0',
          isReady: true,
          isDeFiSupported: false,
          isPerpsSupported: false,
        },
        scopeKey: 'btc--0:single:perp-enabled:0',
        lastReadyResult: {
          scopeKey: 'evm--1:single:perp-enabled:0',
          isReady: true,
          isDeFiSupported: true,
          isPerpsSupported: true,
        },
      }),
    ).toEqual({
      scopeKey: 'btc--0:single:perp-enabled:0',
      isReady: true,
      isDeFiSupported: false,
      isPerpsSupported: false,
    });
  });
});
