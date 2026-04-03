import { OutputFormatter } from '../output';
import { confirmTransaction } from '../utils/confirm-transaction';

describe('confirmTransaction', () => {
  beforeEach(() => {
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips when skipConfirmation is true', async () => {
    await expect(
      confirmTransaction({
        info: { action: 'Transfer 1 ETH', to: '0x123', network: 'eth' },
        output: new OutputFormatter('human'),
        skipConfirmation: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('skips in agent mode when skipConfirmation is true', async () => {
    await expect(
      confirmTransaction({
        info: { action: 'Transfer 1 ETH', to: '0x123', network: 'eth' },
        output: new OutputFormatter('agent'),
        skipConfirmation: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects in agent mode without --yes', async () => {
    await expect(
      confirmTransaction({
        info: { action: 'Transfer 1 ETH', to: '0x123', network: 'eth' },
        output: new OutputFormatter('agent'),
        skipConfirmation: false,
      }),
    ).rejects.toThrow('requires confirmation');
  });

  it('rejects in quiet mode without --yes', async () => {
    await expect(
      confirmTransaction({
        info: { action: 'Transfer 1 ETH', to: '0x123', network: 'eth' },
        output: new OutputFormatter('quiet'),
        skipConfirmation: false,
      }),
    ).rejects.toThrow('requires confirmation');
  });
});
