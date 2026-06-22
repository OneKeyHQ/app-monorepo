import { LedgerAdapter } from './LedgerAdapter';

describe('LedgerAdapter', () => {
  it('passes resetSession through to the HWK adapter searchDevices call', async () => {
    const hw = {
      searchDevices: jest.fn().mockResolvedValue([]),
      on: jest.fn(),
    };
    const adapter = new LedgerAdapter(hw as never);

    await adapter.searchDevices({ resetSession: true });

    expect(hw.searchDevices).toHaveBeenCalledWith({ resetSession: true });
  });

  it('does not repeatedly log completed install progress', () => {
    const hw = {
      searchDevices: jest.fn().mockResolvedValue([]),
      on: jest.fn(),
    };
    const adapter = new LedgerAdapter(hw as never) as unknown as {
      shouldLogAppInstallProgress: (params: {
        connectId: string;
        appName: string;
        progress: number;
      }) => boolean;
    };

    expect(
      adapter.shouldLogAppInstallProgress({
        connectId: '',
        appName: 'Solana',
        progress: 1,
      }),
    ).toBe(true);
    expect(
      adapter.shouldLogAppInstallProgress({
        connectId: '',
        appName: 'Solana',
        progress: 1,
      }),
    ).toBe(false);
  });
});
