jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  const passthrough =
    () => (_target: unknown, _key?: string, descriptor?: PropertyDescriptor) =>
      descriptor;
  return {
    ...actual,
    backgroundClass: passthrough,
    backgroundMethod: passthrough,
  };
});
const ServiceSetting = require('./ServiceSetting')
  .default as typeof import('./ServiceSetting').default;

const ZEC = 'zec--0';

describe('settings clear pending transactions', () => {
  function createService() {
    const clearLocalHistoryPendingTxs = jest.fn(async () => undefined);
    const cleanSwapHistoryItems = jest.fn(async () => undefined);
    const clearSelectedAccountLocalWalletPendingSends = jest.fn(
      async () => undefined,
    );
    const service = Object.assign(
      Object.create(ServiceSetting.prototype) as InstanceType<
        typeof ServiceSetting
      >,
      {
        backgroundApi: {
          serviceHistory: { clearLocalHistoryPendingTxs },
          serviceSwap: { cleanSwapHistoryItems },
          servicePrivacyChain: { clearSelectedAccountLocalWalletPendingSends },
        },
      },
    );
    return {
      service,
      clearLocalHistoryPendingTxs,
      clearSelectedAccountLocalWalletPendingSends,
    };
  }

  // The "pending queue too long" toast of any chain passes no account.
  it('never reaches privacy-chain locks without a selected account', async () => {
    const { service, clearSelectedAccountLocalWalletPendingSends } =
      createService();
    await service.clearPendingTransaction();
    expect(clearSelectedAccountLocalWalletPendingSends).not.toHaveBeenCalled();
  });

  it('passes the selected account on and keeps the general clear on failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const {
      service,
      clearLocalHistoryPendingTxs,
      clearSelectedAccountLocalWalletPendingSends,
    } = createService();
    clearSelectedAccountLocalWalletPendingSends.mockRejectedValueOnce(
      new Error('storage unavailable'),
    );
    const selectedAccount = { networkId: ZEC, accountId: 'hd-1--zec-0' };
    await expect(
      service.clearPendingTransaction({ selectedAccount }),
    ).resolves.toBeUndefined();
    expect(clearLocalHistoryPendingTxs).toHaveBeenCalled();
    expect(clearSelectedAccountLocalWalletPendingSends).toHaveBeenCalledWith(
      selectedAccount,
    );
  });
});
