/*
yarn jest packages/kit-bg/src/services/ServiceAccount/ServiceAccount.freshMnemonic.test.ts
*/
import ServiceAccount from './ServiceAccount';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    AccountUpdate: 'AccountUpdate',
    WalletUpdate: 'WalletUpdate',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

// The members under test are private: they only exist for createHDWallet.
type IFreshMnemonicInternals = {
  consumeFreshMnemonicFlag: (mnemonic: string) => boolean;
  freshMnemonicFingerprints: Map<string, number>;
};

function createService() {
  const service = new ServiceAccount({ backgroundApi: {} });
  return {
    service,
    internals: service as unknown as IFreshMnemonicInternals,
  };
}

describe('ServiceAccount fresh mnemonic flag', () => {
  it('reports a mnemonic generated in this session as fresh, once', async () => {
    const { service, internals } = createService();
    const mnemonic = await service.generateMnemonic();

    expect(internals.consumeFreshMnemonicFlag(mnemonic)).toBe(true);
    expect(internals.consumeFreshMnemonicFlag(mnemonic)).toBe(false);
  });

  it('does not report a mnemonic that was not generated here', async () => {
    const { service, internals } = createService();
    const generated = await service.generateMnemonic();
    const other = await new ServiceAccount({
      backgroundApi: {},
    }).generateMnemonic();

    expect(other).not.toBe(generated);
    expect(internals.consumeFreshMnemonicFlag(other)).toBe(false);
    // Asking about another mnemonic leaves the generated one untouched.
    expect(internals.consumeFreshMnemonicFlag(generated)).toBe(true);
  });

  it('keeps a sha256 digest of the mnemonic, never the mnemonic itself', async () => {
    const { service, internals } = createService();
    const mnemonic = await service.generateMnemonic();

    const keys = Array.from(internals.freshMnemonicFingerprints.keys());
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(keys[0]).not.toContain(mnemonic.split(' ')[0]);
  });
});
