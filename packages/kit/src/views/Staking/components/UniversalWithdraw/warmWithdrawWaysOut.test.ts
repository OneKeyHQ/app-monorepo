import {
  buildWaysOutFirstFrameKey,
  readFirstFrame,
} from '../../../Earn/pages/EarnRouter/earnFirstFrameCache';

import {
  keepWithdrawWaysOutShape,
  warmWithdrawWaysOut,
} from './warmWithdrawWaysOut';

const mockGetAccount = jest.fn<Promise<{ address: string }>, unknown[]>();
const mockGetQuote = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccount: (...args: unknown[]) => mockGetAccount(...args),
    },
    serviceStaking: {
      getTransactionConfirmation: (...args: unknown[]) => mockGetQuote(...args),
    },
  },
}));

const args = {
  accountId: 'account-1',
  networkId: 'evm--1',
  providerName: 'test-provider',
  symbol: 'TOKEN',
  vault: 'vault',
  inputTokenAddress: '0xtoken',
};

describe('withdrawal path prewarming', () => {
  beforeEach(() => {
    mockGetAccount.mockReset();
    mockGetQuote.mockReset();
  });

  it.each([undefined, '', '0', '-1', 'NaN'])(
    'does not query for amount %s',
    async (amount) => {
      await expect(
        warmWithdrawWaysOut({ ...args, amount }),
      ).resolves.toBeUndefined();
      expect(mockGetAccount).not.toHaveBeenCalled();
      expect(mockGetQuote).not.toHaveBeenCalled();
    },
  );

  it('requests a positive amount for the resolved account and retains only placeholder shape', async () => {
    mockGetAccount.mockResolvedValue({ address: '0xaccount' });
    mockGetQuote.mockResolvedValue({
      withdrawPath: {
        data: {
          confirmBoxes: [
            {
              title: { text: 'Private title' },
              description: { text: '123' },
              subtitle: { text: 'Tomorrow' },
              subtitleDescription: { text: '2%' },
              tip: { text: { text: 'Private tip' } },
            },
            { title: { text: 'Second' }, description: { text: '456' } },
          ],
        },
      },
    });
    await warmWithdrawWaysOut({ ...args, amount: '1.25' });
    expect(mockGetQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        accountAddress: '0xaccount',
        amount: '1.25',
        inputTokenAddress: '0xtoken',
      }),
    );
    const shape = readFirstFrame(buildWaysOutFirstFrameKey(args));
    expect(shape).toEqual([
      {
        title: { text: '' },
        description: { text: '' },
        subtitle: { text: ' ' },
        subtitleDescription: { text: ' ' },
      },
      {
        title: { text: '' },
        description: { text: '' },
        subtitle: undefined,
        subtitleDescription: undefined,
      },
    ]);
  });

  it('does not replace cached shape with an absent response', () => {
    const key = { networkId: args.networkId, providerName: 'absent-provider' };
    keepWithdrawWaysOutShape(key);
    expect(readFirstFrame(buildWaysOutFirstFrameKey(key))).toBeUndefined();
  });
});
