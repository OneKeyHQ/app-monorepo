import { checkCustomRpcAvailability } from './useCustomRpcAvailability';

const mockGetCustomRpcForNetwork = jest.fn<Promise<unknown>, unknown[]>();
const mockGetVaultSettings = jest.fn<Promise<unknown>, unknown[]>();
const mockIsCustomNetwork = jest.fn<Promise<unknown>, unknown[]>();
const mockMeasureRpcStatus = jest.fn<Promise<unknown>, unknown[]>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceCustomRpc: {
      getCustomRpcForNetwork: (...args: unknown[]) =>
        mockGetCustomRpcForNetwork(...args),
      measureRpcStatus: (...args: unknown[]) => mockMeasureRpcStatus(...args),
    },
    serviceNetwork: {
      getVaultSettings: (...args: unknown[]) => mockGetVaultSettings(...args),
      isCustomNetwork: (...args: unknown[]) => mockIsCustomNetwork(...args),
    },
  },
}));

describe('checkCustomRpcAvailability', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetCustomRpcForNetwork.mockResolvedValue({
      rpc: 'https://node.example',
      enabled: true,
    });
    mockIsCustomNetwork.mockResolvedValue(false);
    mockMeasureRpcStatus.mockRejectedValue(new Error('unreachable'));
  });

  // Its node is its only data source; offering OneKey RPC would disable it.
  it('never flags a chain that ships its own node', async () => {
    mockGetVaultSettings.mockResolvedValue({
      builtInRpcUrls: ['https://node.example'],
    });
    await expect(checkCustomRpcAvailability('xmr--0')).resolves.toEqual({
      isCustomRpcUnavailable: false,
      isCustomNetwork: false,
    });
    expect(mockMeasureRpcStatus).not.toHaveBeenCalled();
  });

  it('still flags an unreachable custom RPC on other chains', async () => {
    mockGetVaultSettings.mockResolvedValue({});
    await expect(checkCustomRpcAvailability('evm--1')).resolves.toEqual({
      isCustomRpcUnavailable: true,
      customRpcUrl: 'https://node.example',
      isCustomNetwork: false,
    });
  });
});
