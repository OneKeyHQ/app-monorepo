import { ApiRequestError } from '@nktkas/hyperliquid';

import {
  getInternalTransferAddressError,
  getInternalTransferRecentRecipients,
  isInternalTransferAmountValid,
} from '@onekeyhq/shared/src/utils/perpsInternalTransferUtils';
import type {
  IInternalTransferParams,
  IInternalTransferPending,
} from '@onekeyhq/shared/types/hyperliquid/internalTransfer';
import type { IUserNonFundingLedgerUpdate } from '@onekeyhq/shared/types/hyperliquid/sdk';

import ServiceHyperliquidExchange from './ServiceHyperliquidExchange';

import type { WalletHyperliquidOnekey } from './ServiceHyperliquidWallet';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

const source = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const destination = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const userAccountId = 'hd-1--evm--0';
let active = { accountId: userAccountId, accountAddress: source };
let pending: IInternalTransferPending | undefined;
let clientWallet: Pick<WalletHyperliquidOnekey, 'signTypedData' | 'getAddress'>;
const sign = jest.fn();
const post = jest.fn();
const getAddress = jest.fn();
const preTransferCheck = jest.fn();
const userAbstraction = jest.fn();
const spotClearinghouseState = jest.fn();
const clearinghouseState = jest.fn();
const spotMetaAndAssetCtxs = jest.fn();
const usdcId = '0x6d1e7cde53ba9467b783cb7c530ce054';
const hypeId = '0x0d01dc56dcaaca66ad901c959b4011ec';
const metadata = [
  {
    tokens: [
      { index: 0, name: 'USDC', tokenId: usdcId, weiDecimals: 8 },
      { index: 150, name: 'HYPE', tokenId: hypeId, weiDecimals: 8 },
      { index: 197, name: 'UBTC', tokenId: 'ubtc-id', weiDecimals: 10 },
    ],
    universe: [
      { name: '@107', tokens: [150, 0] },
      { name: '@200', tokens: [197, 150] },
    ],
  },
  [
    { coin: '@107', markPx: '20' },
    { coin: '@200', markPx: '3000' },
  ],
];
const userNonFundingLedgerUpdates = jest.fn();
const subAccounts = jest.fn();
const setPending = jest.fn();
const invalidate = jest.fn();
const subscribe = jest.fn();
const nonce = 1_793_685_600_000;
function recentSend(
  address: `0x${string}`,
  time: number,
  amount = '1',
  sender: `0x${string}` = source,
): IUserNonFundingLedgerUpdate {
  return {
    time,
    hash: '0x0',
    delta: {
      type: 'send',
      user: sender,
      destination: address,
      sourceDex: 'spot',
      destinationDex: 'spot',
      token: 'USDC',
      amount,
      usdcValue: amount,
      fee: '0',
      nativeTokenFee: '0',
      feeToken: 'USDC',
      nonce: time,
    },
  };
}
const params: IInternalTransferParams = {
  userAccountId,
  expectedAccountAddress: source,
  destination,
  amount: '10',
  expectedFee: '1',
  expectedSourceDex: 'spot',
  expectedDestinationDex: 'spot',
  source: 'trading',
  tokenId: usdcId,
  expectedToken: `USDC:${usdcId}`,
};

jest.mock('@nktkas/hyperliquid', () => {
  class MockApiRequestError extends Error {}
  return {
    ApiRequestError: MockApiRequestError,
    HttpTransport: jest.fn(),
    ExchangeClient: jest
      .fn()
      .mockImplementation(({ wallet }: { wallet: typeof clientWallet }) => {
        clientWallet = wallet;
        return {
          sendAsset: async (action: unknown) => {
            await wallet.signTypedData(
              {
                name: 'HyperliquidSignTransaction',
                version: '1',
                chainId: 42_161,
                verifyingContract: '0x0000000000000000000000000000000000000000',
              },
              {
                'HyperliquidTransaction:SendAsset': [
                  { name: 'nonce', type: 'uint64' },
                ],
              },
              { nonce },
            );
            await post(action);
            return { status: 'ok', response: { type: 'default' } };
          },
        };
      }),
  };
});
jest.mock('./hyperLiquidApiClients', () => ({
  hyperLiquidApiClients: {
    get infoClient() {
      return {
        preTransferCheck,
        userAbstraction,
        spotClearinghouseState,
        clearinghouseState,
        spotMetaAndAssetCtxs,
        userNonFundingLedgerUpdates,
        subAccounts,
      };
    },
  },
}));
jest.mock('../../states/jotai/atoms', () => ({
  perpsActiveAccountAtom: { get: async () => active },
}));

describe('HL internal token transfers', () => {
  let service: ServiceHyperliquidExchange;
  let backgroundApi: IBackgroundApi;
  const previousScope = globalThis.$onekeyIsInBackground;
  beforeEach(() => {
    globalThis.$onekeyIsInBackground = true;
    jest.clearAllMocks();
    pending = undefined;
    active = { accountId: userAccountId, accountAddress: source };
    getAddress.mockResolvedValue(source);
    sign.mockResolvedValue('signature');
    post.mockResolvedValue({ status: 'ok', response: { type: 'default' } });
    userAbstraction.mockResolvedValue('unifiedAccount');
    preTransferCheck.mockResolvedValue({
      fee: '1',
      isSanctioned: false,
      userExists: false,
    });
    spotClearinghouseState.mockResolvedValue({
      balances: [{ token: 0, total: '100', hold: '20' }],
    });
    clearinghouseState.mockResolvedValue({ withdrawable: '40' });
    spotMetaAndAssetCtxs.mockResolvedValue(metadata);
    userNonFundingLedgerUpdates.mockResolvedValue([]);
    subAccounts.mockResolvedValue(null);
    setPending.mockImplementation(
      async (
        _address: string,
        value: IInternalTransferPending | undefined,
        expectedNonce?: number,
      ) => {
        if (value || pending?.nonce === expectedNonce) pending = value;
      },
    );
    invalidate.mockResolvedValue(undefined);
    subscribe.mockResolvedValue(undefined);
    backgroundApi = {
      simpleDb: {
        perp: {
          getInternalTransferPending: async () => pending,
          setInternalTransferPending: setPending,
        },
      },
      serviceHyperliquidWallet: {
        getOnekeyWallet: async () => ({ getAddress, signTypedData: sign }),
      },
      serviceHyperliquid: {
        invalidateHyperliquidPortfolio: invalidate,
        getUserNonFundingLedgerUpdates: userNonFundingLedgerUpdates,
      },
      serviceHyperliquidSubscription: {
        enableLedgerUpdatesSubscription: subscribe,
      },
    } as unknown as IBackgroundApi;
    service = new ServiceHyperliquidExchange({ backgroundApi });
  });
  afterEach(() => {
    globalThis.$onekeyIsInBackground = previousScope;
  });

  it('preserves the three-argument signer required by the SDK wallet adapter', async () => {
    await service.transferAssetInternally(params);
    expect(clientWallet.signTypedData.length).toBe(3);
    await expect(clientWallet.getAddress()).resolves.toBe(source);
  });

  it('shares preview queries across source, token and recipient changes but checks each recipient', async () => {
    await service.getInternalTransferSources(params);
    await Promise.all([
      service.getInternalTransferTokens(params),
      service.getInternalTransferQuote(params),
    ]);
    await service.getInternalTransferTokens({
      ...params,
      selectedTokenId: hypeId,
    });
    await service.getInternalTransferQuote({
      ...params,
      destination: '0xcccccccccccccccccccccccccccccccccccccccc',
    });
    expect(userAbstraction).toHaveBeenCalledTimes(1);
    expect(spotMetaAndAssetCtxs).toHaveBeenCalledTimes(1);
    expect(spotClearinghouseState).toHaveBeenCalledTimes(1);
    expect(preTransferCheck).toHaveBeenCalledTimes(2);
  });

  it('bypasses preview data for both signing checks and clears it after sending', async () => {
    await service.getInternalTransferQuote(params);
    await service.transferAssetInternally(params);
    expect(userAbstraction).toHaveBeenCalledTimes(3);
    expect(spotMetaAndAssetCtxs).toHaveBeenCalledTimes(3);
    expect(spotClearinghouseState).toHaveBeenCalledTimes(3);
    await service.getInternalTransferQuote(params);
    expect(spotClearinghouseState).toHaveBeenCalledTimes(4);
  });

  it('refreshes preview data after five seconds', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    try {
      await service.getInternalTransferQuote(params);
      await jest.advanceTimersByTimeAsync(5001);
      await service.getInternalTransferQuote(params);
      expect(userAbstraction).toHaveBeenCalledTimes(2);
      expect(spotClearinghouseState).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects a reduced balance even while the preview is cached', async () => {
    await service.getInternalTransferQuote(params);
    spotClearinghouseState.mockResolvedValue({
      balances: [{ token: 0, total: '1', hold: '0' }],
    });
    await expect(service.transferAssetInternally(params)).rejects.toThrow(
      'available balance',
    );
    expect(sign).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('does not reuse another account preview and still guards cached reads', async () => {
    await service.getInternalTransferQuote(params);
    active = { accountId: 'hd-2--evm--0', accountAddress: destination };
    getAddress.mockResolvedValue(destination);
    await expect(service.getInternalTransferTokens(params)).rejects.toThrow(
      'active account changed',
    );
    await service.getInternalTransferTokens({
      ...params,
      userAccountId: active.accountId,
      expectedAccountAddress: destination,
    });
    expect(spotClearinghouseState).toHaveBeenCalledTimes(2);
    expect(spotClearinghouseState).toHaveBeenLastCalledWith({
      user: destination,
    });
  });

  it('returns a first-send warning even when there is no activation fee', async () => {
    preTransferCheck.mockResolvedValue({
      fee: '0',
      isSanctioned: false,
      userExists: true,
      userHasSentTx: false,
    });
    await expect(
      service.getInternalTransferQuote(params),
    ).resolves.toMatchObject({
      fee: '0',
      userHasSentTx: false,
    });
    await expect(
      service.transferAssetInternally({
        ...params,
        expectedFee: '0',
        expectedUserHasSentTx: false,
      }),
    ).resolves.toBe('confirmed');
  });

  it.each(['before signing', 'after signing'])(
    'requires a new review when the recipient needs a warning %s',
    async (stage) => {
      const changeStatus = () =>
        preTransferCheck.mockResolvedValue({
          fee: '1',
          isSanctioned: false,
          userExists: true,
          userHasSentTx: false,
        });
      if (stage === 'before signing') changeStatus();
      else
        sign.mockImplementation(async () => {
          changeStatus();
          return 'signature';
        });
      await expect(
        service.transferAssetInternally({
          ...params,
          expectedUserHasSentTx: true,
        }),
      ).rejects.toThrow('recipient account status changed');
      expect(post).not.toHaveBeenCalled();
      expect(pending).toBeUndefined();
    },
  );

  it('loads recent recipients for the bound account and excludes its subaccounts', async () => {
    subAccounts.mockResolvedValue([{ subAccountUser: destination }]);
    userNonFundingLedgerUpdates.mockResolvedValue([
      recentSend(destination, 2),
      recentSend('0xcccccccccccccccccccccccccccccccccccccccc', 1),
    ]);
    await expect(
      service.getInternalTransferRecentRecipients(params),
    ).resolves.toEqual([
      {
        address: '0xcccccccccccccccccccccccccccccccccccccccc',
        amount: '1',
        token: 'USDC',
      },
    ]);
    expect(subAccounts).toHaveBeenCalledWith({ user: source });
    expect(userNonFundingLedgerUpdates).toHaveBeenCalledWith(source);
    active = { ...active, accountAddress: destination };
    await expect(
      service.getInternalTransferRecentRecipients(params),
    ).rejects.toThrow();
  });

  it('deduplicates outgoing sends, newest first, and limits recipients to five', () => {
    const updates = [
      recentSend(destination, 1),
      recentSend('0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 9, '2'),
      ...Array.from({ length: 6 }, (_, index) =>
        recentSend(`0x${String(index + 1).repeat(40)}`, index + 2),
      ),
    ];
    const recipients = getInternalTransferRecentRecipients(updates, source, []);
    expect(recipients).toHaveLength(5);
    expect(recipients[0]).toEqual({
      address: destination,
      amount: '2',
      token: 'USDC',
    });
    expect(recipients[1].address).toBe(`0x${'6'.repeat(40)}`);
    expect(
      recipients.filter((item) => item.address === destination),
    ).toHaveLength(1);
  });

  it('excludes incoming, self, system, bridge, subaccount and zero-value sends', () => {
    const updates = [
      recentSend(source, 10, '1', destination),
      recentSend(source, 9),
      recentSend('0x2000000000000000000000000000000000000001', 8),
      recentSend('0x2222222222222222222222222222222222222222', 7),
      recentSend('0x574bafce69d9411f662a433896e74e4f153096fa', 6),
      recentSend('0xcccccccccccccccccccccccccccccccccccccccc', 5),
      recentSend(destination, 4, '0'),
      recentSend(destination, 3),
    ];
    expect(
      getInternalTransferRecentRecipients(updates, source, [
        '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      ]),
    ).toEqual([{ address: destination, amount: '1', token: 'USDC' }]);
  });

  it('keeps the stablecoin activation fee separate and excludes held spot USDC', async () => {
    await expect(
      service.getInternalTransferQuote(params),
    ).resolves.toMatchObject({ maxAmount: '80', sourceDex: 'spot', fee: '1' });
    expect(preTransferCheck).toHaveBeenCalledWith({
      source,
      user: destination,
    });
  });
  it.each(['default', 'disabled'])(
    'uses only the main perp balance in %s mode',
    async (mode) => {
      userAbstraction.mockResolvedValue(mode);
      await expect(
        service.getInternalTransferQuote({ ...params, source: 'perps' }),
      ).resolves.toMatchObject({
        maxAmount: '40',
        sourceDex: '',
        destinationDex: '',
      });
      expect(spotClearinghouseState).not.toHaveBeenCalled();
    },
  );
  it('uses the spot balance for portfolio margin accounts', async () => {
    userAbstraction.mockResolvedValue('portfolioMargin');
    await expect(
      service.getInternalTransferQuote(params),
    ).resolves.toMatchObject({ sourceDex: 'spot' });
  });
  it.each(['unifiedAccount', 'portfolioMargin'])(
    'offers only Trading Account in %s mode',
    async (mode) => {
      userAbstraction.mockResolvedValue(mode);
      await expect(service.getInternalTransferSources(params)).resolves.toEqual(
        ['trading'],
      );
      await expect(
        service.getInternalTransferQuote({ ...params, source: 'perps' }),
      ).rejects.toThrow('source account changed');
      await expect(
        service.getInternalTransferQuote({ ...params, source: 'spot' }),
      ).rejects.toThrow('source account changed');
    },
  );
  it.each(['default', 'disabled'])(
    'offers separate accounts in %s mode',
    async (mode) => {
      userAbstraction.mockResolvedValue(mode);
      await expect(service.getInternalTransferSources(params)).resolves.toEqual(
        ['perps', 'spot'],
      );
      await expect(service.getInternalTransferQuote(params)).rejects.toThrow(
        'source account changed',
      );
      await expect(
        service.getInternalTransferQuote({ ...params, source: 'spot' }),
      ).resolves.toMatchObject({
        maxAmount: '80',
        sourceDex: 'spot',
        destinationDex: 'spot',
      });
    },
  );
  it('sends from the selected standard account to the matching destination balance', async () => {
    userAbstraction.mockResolvedValue('disabled');
    await expect(
      service.transferAssetInternally({
        ...params,
        source: 'perps',
        expectedToken: 'USDC',
        expectedSourceDex: '',
        expectedDestinationDex: '',
      }),
    ).resolves.toBe('confirmed');
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceDex: '', destinationDex: '' }),
    );
    await expect(
      service.transferAssetInternally({ ...params, source: 'spot' }),
    ).resolves.toBe('confirmed');
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceDex: 'spot', destinationDex: 'spot' }),
    );
  });
  it('rejects a destination account that differs from the reviewed source', async () => {
    await expect(
      service.transferAssetInternally({
        ...params,
        expectedDestinationDex: '',
      }),
    ).rejects.toThrow('source account or fee changed');
    expect(sign).not.toHaveBeenCalled();
  });
  it('uses spotHold when provided for a shared trading balance', async () => {
    spotClearinghouseState.mockResolvedValue({
      balances: [{ token: 0, total: '100', hold: '30', spotHold: '10' }],
    });
    await expect(
      service.getInternalTransferQuote(params),
    ).resolves.toMatchObject({ maxAmount: '90' });
  });
  it('matches the stored destination for perps ledger confirmations', async () => {
    pending = {
      nonce,
      destination,
      amount: '10',
      sourceDex: '',
      destinationDex: '',
    };
    const delta = {
      type: 'send',
      nonce,
      user: source,
      destination,
      amount: '10',
      sourceDex: '',
      destinationDex: 'spot',
      token: 'USDC',
    };
    userNonFundingLedgerUpdates.mockResolvedValue([{ delta }]);
    await expect(service.checkInternalTransfer(params)).resolves.toMatchObject({
      status: 'pending',
    });
    userNonFundingLedgerUpdates.mockResolvedValue([
      { delta: { ...delta, destinationDex: '' } },
    ]);
    await expect(service.checkInternalTransfer(params)).resolves.toEqual({
      status: 'confirmed',
    });
  });
  it('signs with the principal and persists the nonce before posting to spot', async () => {
    post.mockImplementation(async () => {
      expect(pending).toEqual({
        nonce,
        amount: '10',
        sourceDex: 'spot',
        destinationDex: 'spot',
        destination,
        token: `USDC:${usdcId}`,
        symbol: 'USDC',
      });
    });
    await expect(service.transferAssetInternally(params)).resolves.toBe(
      'confirmed',
    );
    expect(sign).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith({
      destination,
      sourceDex: 'spot',
      destinationDex: 'spot',
      token: `USDC:${usdcId}`,
      amount: '10',
      fromSubAccount: '',
    });
    expect(pending).toBeUndefined();
    expect(invalidate).toHaveBeenCalledWith(source);
  });
  it.each(['0', '-1', '1e1', '0.000000001', '81', 'NaN'])(
    'rejects invalid or unavailable amount %s before signing',
    async (amount) => {
      await expect(
        service.transferAssetInternally({ ...params, amount }),
      ).rejects.toThrow();
      expect(sign).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    },
  );
  it.each([
    source,
    '0x0000000000000000000000000000000000000000',
    '0x2000000000000000000000000000000000000000',
    'invalid',
  ])('rejects unsafe destination %s', async (recipient) => {
    await expect(
      service.transferAssetInternally({ ...params, destination: recipient }),
    ).rejects.toThrow();
    expect(preTransferCheck).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
  });
  it.each([
    { isSanctioned: true, fee: '0' },
    { fee: '0' },
    { isSanctioned: false, fee: '-1' },
  ])('fails closed on restricted or malformed preflight %j', async (check) => {
    preTransferCheck.mockResolvedValue(check);
    await expect(service.transferAssetInternally(params)).rejects.toThrow();
    expect(sign).not.toHaveBeenCalled();
  });
  it('rejects a mismatched signer', async () => {
    getAddress.mockResolvedValue(destination);
    await expect(service.transferAssetInternally(params)).rejects.toThrow(
      'signing account changed',
    );
    expect(sign).not.toHaveBeenCalled();
  });
  it('rejects an account switch while the wallet is signing', async () => {
    sign.mockImplementation(async () => {
      active = { ...active, accountAddress: destination };
      return 'signature';
    });
    await expect(service.transferAssetInternally(params)).rejects.toThrow(
      'active account changed',
    );
    expect(post).not.toHaveBeenCalled();
    expect(pending).toBeUndefined();
  });
  it.each(['fee', 'mode', 'balance'])(
    'rechecks %s after signing',
    async (change) => {
      sign.mockImplementation(async () => {
        if (change === 'fee')
          preTransferCheck.mockResolvedValue({ fee: '2', isSanctioned: false });
        if (change === 'mode') userAbstraction.mockResolvedValue('disabled');
        if (change === 'balance')
          spotClearinghouseState.mockResolvedValue({ balances: [] });
        return 'signature';
      });
      await expect(service.transferAssetInternally(params)).rejects.toThrow();
      expect(post).not.toHaveBeenCalled();
    },
  );
  it('does not post if the account changes while saving the signed attempt', async () => {
    setPending.mockImplementationOnce(
      async (_address: string, value: IInternalTransferPending) => {
        pending = value;
        active = { ...active, accountAddress: destination };
      },
    );
    await expect(service.transferAssetInternally(params)).rejects.toThrow(
      'active account changed',
    );
    expect(pending).toBeUndefined();
    expect(post).not.toHaveBeenCalled();
  });
  it('keeps cancellation retryable without posting', async () => {
    sign.mockRejectedValue(new Error('Cancelled'));
    await expect(service.transferAssetInternally(params)).rejects.toThrow(
      'Cancelled',
    );
    expect(pending).toBeUndefined();
    expect(post).not.toHaveBeenCalled();
  });
  it('blocks concurrent submissions', async () => {
    let resolveSign: (signature: string) => void = () => undefined;
    sign.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveSign = resolve;
        }),
    );
    const first = service.transferAssetInternally(params);
    await expect(service.transferAssetInternally(params)).rejects.toThrow(
      'already in progress',
    );
    while (!sign.mock.calls.length) await Promise.resolve();
    resolveSign('signature');
    await expect(first).resolves.toBe('confirmed');
    expect(post).toHaveBeenCalledTimes(1);
  });
  it('restores transport uncertainty in a new service instance and blocks a second send', async () => {
    post.mockRejectedValue(new Error('Timeout'));
    await expect(service.transferAssetInternally(params)).resolves.toBe(
      'pending',
    );
    service = new ServiceHyperliquidExchange({ backgroundApi });
    await expect(service.checkInternalTransfer(params)).resolves.toMatchObject({
      status: 'pending',
      pending: { nonce },
    });
    await expect(service.transferAssetInternally(params)).rejects.toThrow(
      'previous transfer',
    );
    expect(post).toHaveBeenCalledTimes(1);
    expect(sign).toHaveBeenCalledTimes(1);
  });
  it('releases a definitively rejected request', async () => {
    post.mockRejectedValue(
      new ApiRequestError({ status: 'err', response: 'Insufficient margin' }),
    );
    await expect(service.transferAssetInternally(params)).rejects.toThrow();
    expect(pending).toBeUndefined();
  });
  it('reconciles only the exact nonce, recipient and amount', async () => {
    pending = { nonce, destination, amount: '10', sourceDex: 'spot' };
    const delta = {
      type: 'send',
      nonce: nonce - 1,
      user: source,
      destination,
      amount: '10',
      sourceDex: 'spot',
      destinationDex: 'spot',
      token: 'USDC',
    };
    userNonFundingLedgerUpdates.mockResolvedValue([{ delta }]);
    await expect(service.checkInternalTransfer(params)).resolves.toMatchObject({
      status: 'pending',
    });
    userNonFundingLedgerUpdates.mockResolvedValue([
      { delta: { ...delta, nonce } },
    ]);
    await expect(service.checkInternalTransfer(params)).resolves.toEqual({
      status: 'confirmed',
    });
    expect(pending).toBeUndefined();
  });
  it('does not send when durable tracking cannot be written', async () => {
    setPending.mockRejectedValue(new Error('Storage failed'));
    await expect(service.transferAssetInternally(params)).rejects.toThrow(
      'Storage failed',
    );
    expect(post).not.toHaveBeenCalled();
  });
  it('sorts held tokens by value and resolves quote-token prices', async () => {
    spotClearinghouseState.mockResolvedValue({
      balances: [
        { token: 150, total: '10', hold: '2' },
        { token: 197, total: '0.01', hold: '0' },
      ],
    });
    await expect(
      service.getInternalTransferTokens(params),
    ).resolves.toMatchObject([
      { symbol: 'UBTC', usdValue: '600', decimals: 10 },
      { symbol: 'HYPE', usdValue: '200', balance: '8' },
      { symbol: 'USDC', balance: '0' },
    ]);
  });
  it('retains the selected token when its balance is zero', async () => {
    spotClearinghouseState.mockResolvedValue({ balances: [] });
    await expect(
      service.getInternalTransferTokens({ ...params, selectedTokenId: hypeId }),
    ).resolves.toMatchObject([{ id: hypeId, balance: '0' }]);
  });
  it('sends HYPE with its canonical token identifier and native precision', async () => {
    spotClearinghouseState.mockResolvedValue({
      balances: [{ token: 150, total: '2', hold: '0.5' }],
    });
    const hype = {
      ...params,
      tokenId: hypeId,
      expectedToken: `HYPE:${hypeId}`,
      amount: '1.12345678',
    };
    await expect(service.getInternalTransferQuote(hype)).resolves.toMatchObject(
      { maxAmount: '1.5', fee: '1', asset: { symbol: 'HYPE', decimals: 8 } },
    );
    await expect(service.transferAssetInternally(hype)).resolves.toBe(
      'confirmed',
    );
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        token: `HYPE:${hypeId}`,
        amount: '1.12345678',
      }),
    );
  });
  it('uses token IDs rather than names and preserves ten-decimal token amounts', async () => {
    spotMetaAndAssetCtxs.mockResolvedValue([
      {
        tokens: [
          { index: 0, name: 'USDC', tokenId: usdcId, weiDecimals: 8 },
          { index: 197, name: 'USDC', tokenId: 'other-id', weiDecimals: 10 },
        ],
        universe: [],
      },
      [],
    ]);
    spotClearinghouseState.mockResolvedValue({
      balances: [{ token: 197, total: '0.0000000001', hold: '0' }],
    });
    await expect(
      service.transferAssetInternally({
        ...params,
        tokenId: 'other-id',
        expectedToken: 'USDC:other-id',
        amount: '0.0000000001',
      }),
    ).resolves.toBe('confirmed');
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'USDC:other-id',
        amount: '0.0000000001',
      }),
    );
  });
  it('restricts perps to USDC and two decimal places', async () => {
    userAbstraction.mockResolvedValue('disabled');
    const perps: IInternalTransferParams = {
      ...params,
      source: 'perps' as const,
      expectedSourceDex: '',
      expectedDestinationDex: '',
      expectedToken: 'USDC',
    };
    await expect(
      service.getInternalTransferTokens(perps),
    ).resolves.toMatchObject([{ id: usdcId, decimals: 2 }]);
    await expect(
      service.getInternalTransferQuote({ ...perps, tokenId: hypeId }),
    ).rejects.toThrow('selected token');
    await expect(
      service.transferAssetInternally({ ...perps, amount: '1.001' }),
    ).rejects.toThrow('2 decimal');
    expect(sign).not.toHaveBeenCalled();
  });
  it('rejects a token identity change after wallet signing', async () => {
    sign.mockImplementation(async () => {
      spotMetaAndAssetCtxs.mockResolvedValue([
        {
          tokens: [
            { index: 0, name: 'OTHER', tokenId: usdcId, weiDecimals: 8 },
          ],
          universe: [],
        },
        [],
      ]);
      return 'signature';
    });
    await expect(service.transferAssetInternally(params)).rejects.toThrow(
      'token, source account or fee changed',
    );
    expect(post).not.toHaveBeenCalled();
  });
  it('does not confirm a different token with the same amount and nonce', async () => {
    pending = {
      nonce,
      destination,
      amount: '10',
      sourceDex: 'spot',
      token: `HYPE:${hypeId}`,
      symbol: 'HYPE',
    };
    const delta = {
      type: 'send',
      nonce,
      user: source,
      destination,
      amount: '10',
      sourceDex: 'spot',
      destinationDex: 'spot',
      token: 'USDC',
    };
    userNonFundingLedgerUpdates.mockResolvedValue([{ delta }]);
    await expect(service.checkInternalTransfer(params)).resolves.toMatchObject({
      status: 'pending',
    });
    userNonFundingLedgerUpdates.mockResolvedValue([
      { delta: { ...delta, token: 'HYPE' } },
    ]);
    await expect(service.checkInternalTransfer(params)).resolves.toMatchObject({
      status: 'confirmed',
    });
  });
  it('validates checksum and decimal boundaries consistently with the form', () => {
    expect(
      getInternalTransferAddressError(
        '0x52908400098527886E0F7030069857D2E4169Ee7',
        source,
      ),
    ).toBeDefined();
    expect(isInternalTransferAmountValid('0.000001', '0.000001', 8)).toBe(true);
    expect(isInternalTransferAmountValid('0.000002', '0.000001', 8)).toBe(
      false,
    );
  });
});
