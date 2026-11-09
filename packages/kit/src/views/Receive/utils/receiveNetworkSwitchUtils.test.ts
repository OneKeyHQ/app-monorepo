import { resolveReceiveNetworkSwitchable } from './receiveNetworkSwitchUtils';

describe('resolveReceiveNetworkSwitchable', () => {
  const base = { switchEntry: 'token' as const, memberCount: 3 };

  it('is off unless the entry opts in', () => {
    expect(
      resolveReceiveNetworkSwitchable({ ...base, switchEntry: undefined })
        .isSwitchable,
    ).toBe(false);
  });

  it('needs at least two members for a token entry', () => {
    expect(
      resolveReceiveNetworkSwitchable({ ...base, memberCount: 1 }).isSwitchable,
    ).toBe(false);
    expect(
      resolveReceiveNetworkSwitchable({ ...base, memberCount: 2 }).isSwitchable,
    ).toBe(true);
  });

  it('ignores the member count for a network entry', () => {
    expect(
      resolveReceiveNetworkSwitchable({
        switchEntry: 'network',
        memberCount: 0,
      }).isSwitchable,
    ).toBe(true);
  });

  it('never switches in exchange deposit or BTC used-address modes', () => {
    expect(
      resolveReceiveNetworkSwitchable({ ...base, exchangeSource: 'binance' })
        .isSwitchable,
    ).toBe(false);
    expect(
      resolveReceiveNetworkSwitchable({
        ...base,
        isBtcUsedAddressVerifyMode: true,
      }).isSwitchable,
    ).toBe(false);
  });

  it('keeps the trigger visible but disabled while verifying or preparing a share', () => {
    expect(
      resolveReceiveNetworkSwitchable({ ...base, isVerifying: true }),
    ).toEqual({ isSwitchable: true, isSwitchEnabled: false });
    expect(
      resolveReceiveNetworkSwitchable({ ...base, isPreparingShare: true }),
    ).toEqual({ isSwitchable: true, isSwitchEnabled: false });
  });
});
