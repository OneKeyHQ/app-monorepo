// Mock localDb for database-dependent testing

export function createMockLocalDb() {
  return {
    getCredential: jest.fn(),
    getAccount: jest.fn(),
    getWallet: jest.fn(),
    getDevice: jest.fn(),
    getNetwork: jest.fn(),
    addAccountToWallet: jest.fn(),
    removeAccount: jest.fn(),
  };
}
