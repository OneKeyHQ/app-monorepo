// Mock backgroundApi for service/vault testing
// Provides minimal stubs for the most common service interactions

export function createMockBackgroundApi() {
  return {
    serviceNetwork: {
      getNetwork: jest.fn(),
      getNetworkSafe: jest.fn(),
      getNetworkChainId: jest.fn(),
      getVaultSettings: jest.fn(),
    },
    serviceAccount: {
      getAccount: jest.fn(),
      getAccountSafe: jest.fn(),
    },
    servicePassword: {
      encodeSensitiveText: jest.fn((params: { text: string }) =>
        Promise.resolve(params.text),
      ),
      decodeSensitiveText: jest.fn((params: { encodedText: string }) =>
        Promise.resolve(params.encodedText),
      ),
    },
    serviceHardware: {
      getSDKInstance: jest.fn(),
    },
    walletFactory: {
      getVault: jest.fn(),
    },
  };
}
