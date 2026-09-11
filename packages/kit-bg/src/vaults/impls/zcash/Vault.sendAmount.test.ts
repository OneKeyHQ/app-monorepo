/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import BigNumber from 'bignumber.js';

import type {
  IZcashBalance,
  IZcashPoolDetail,
  IZcashTransparentTxRequest,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import Vault from './Vault';

function pool(spendable: string): IZcashPoolDetail {
  return {
    spendable,
    total: spendable,
    pendingChange: '0',
    pendingSpendable: '0',
    locked: '0',
  };
}

function balance(
  ironwood: string,
  transparent: string,
  orchard = '0',
): IZcashBalance {
  const shielded = String(BigInt(ironwood) + BigInt(orchard));
  return {
    shielded,
    transparent,
    spendable: shielded,
    total: String(BigInt(shielded) + BigInt(transparent)),
    pendingChange: '0',
    pendingSpendable: '0',
    orchardBalance: orchard,
    ironwoodBalance: ironwood,
    transparentBalance: transparent,
    shieldedSpendable: shielded,
    transparentRegularBalance: transparent,
    transparentCoinbaseBalance: '0',
    poolsDetail: {
      ironwood: pool(ironwood),
      orchard: pool(orchard),
      transparentRegular: pool(transparent),
      transparentCoinbase: pool('0'),
    },
  };
}

describe('Zcash send amount intent', () => {
  function createVault(
    snapshot: IZcashBalance | null,
    preferTransparent = false,
  ) {
    const quotePczt = jest.fn().mockResolvedValue({ feeZat: '10000' });
    const account = { id: 'test-account' };
    const vault: Vault = Object.assign(
      Object.create(Vault.prototype) as Vault,
      {
        accountId: account.id,
        backgroundApi: {
          simpleDb: {
            zcash: {
              getPrivacyModeState: async () => ({
                intent: 'on',
                preferTransparentForShieldedSends: preferTransparent,
              }),
            },
          },
          serviceAccount: { getDBAccount: async () => account },
        },
        zcashGetApi: async () => ({ quotePczt }),
        zcashGetWalletAccount: async () => account,
        zcashGetBalanceSafe: async () => snapshot,
        getLocalWalletBalance: async () => snapshot,
        zcashGetIndexerTransparentBalance: async () => ({
          total: new BigNumber('500000000'),
          spendable: new BigNumber('500000000'),
        }),
      },
    );
    return { vault, quotePczt };
  }

  it('keeps indexer funds spendable when the privacy scanner is unavailable', async () => {
    const { vault } = createVault(null);
    await expect(
      vault.listLocalWalletSendPools({ accountId: 'test-account' }),
    ).resolves.toEqual([
      expect.objectContaining({
        key: 'transparent',
        spendable: '500000000',
        eligible: true,
      }),
    ]);
  });

  function request(amount: string, isMaxSend = false, to = 'u1-recipient') {
    return {
      transfersInfo: [
        { from: 't1-from', to, amount, localWalletSourcePool: 'ironwood' },
      ],
      transferPayload: {
        amountToSend: amount,
        originalRecipient: to,
        isMaxSend,
        isNFT: false,
      },
    };
  }

  it.each(['1', '2'])(
    'does not turn an entered %s ZEC into Max against a 1 ZEC snapshot',
    async (amount) => {
      const { vault, quotePczt } = createVault(balance('100000000', '0'));
      const encoded = await vault.buildEncodedTx(request(amount));
      expect(encoded.zcashAmountValue).toBe(
        String(BigInt(amount) * 100_000_000n),
      );
      expect(quotePczt).not.toHaveBeenCalled();
    },
  );

  it('allows an exact amount backed by transparent inputs when the shielded balance is zero', async () => {
    const { vault } = createVault(balance('0', '200000000'), true);
    const encoded = await vault.buildEncodedTx(request('1'));
    expect(encoded.zcashAmountValue).toBe('100000000');
    expect(encoded.zcashSpendTransparent).toBe(true);
  });

  it('converges explicit Max against the selected shielded pool only', async () => {
    const { vault, quotePczt } = createVault(
      balance('100000000', '200000000', '300000000'),
    );
    const encoded = await vault.buildEncodedTx(request('1', true));
    expect(encoded.zcashAmountValue).toBe('99990000');
    expect(quotePczt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        spendSource: 'ironwood',
        spendTransparent: false,
        valueZat: '99990000',
      }),
    );
  });

  it('includes permitted transparent inputs in shielded-recipient Max', async () => {
    const { vault, quotePczt } = createVault(
      balance('0', '200000000', '300000000'),
      true,
    );
    const encoded = await vault.buildEncodedTx(request('2', true));
    expect(encoded.zcashAmountValue).toBe('199990000');
    expect(quotePczt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        spendSource: 'ironwood',
        spendTransparent: true,
      }),
    );
  });

  it('keeps a withdrawal limited to its shielded pool even when transparent-first is enabled', async () => {
    const { vault } = createVault(balance('100000000', '200000000'), true);
    const encoded = await vault.buildEncodedTx(
      request('1', true, 't1-recipient'),
    );
    expect(encoded.zcashAmountValue).toBe('99990000');
    expect(encoded.zcashSpendTransparent).toBe(false);
  });

  it.each(['ironwood', 'orchard'])(
    'preserves the Withdraw source %s for a transparent recipient',
    async (source) => {
      const { vault, quotePczt } = createVault(
        balance('100000000', '0', '200000000'),
      );
      const encoded = await vault.buildEncodedTx({
        transfersInfo: [
          {
            from: 't1-from',
            to: 't1-recipient',
            amount: '2',
            localWalletSpendSource: source,
          },
        ],
        transferPayload: {
          amountToSend: '2',
          originalRecipient: 't1-recipient',
          isMaxSend: true,
          isNFT: false,
        },
      });
      expect(encoded.zcashMode).toBe('privacy');
      expect(encoded.zcashSpendSource).toBe(source);
      expect(quotePczt).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          spendSource: source,
          spendTransparent: false,
        }),
      );
    },
  );

  it('does not silently use an entered amount when Max has no reliable balance', async () => {
    const { vault } = createVault(null);
    await expect(
      vault.buildEncodedTx(request('1', true)),
    ).rejects.toMatchObject({ code: 'NOT_SYNCED' });
  });

  it('offers the same policy-dependent ceiling to the amount page as to Max', async () => {
    const { vault } = createVault(balance('100000000', '200000000'), true);
    const shielded = await vault.listLocalWalletSendPools({
      accountId: vault.accountId,
      toAddress: 'u1-recipient',
    });
    const withdrawal = await vault.listLocalWalletSendPools({
      accountId: vault.accountId,
      toAddress: 't1-recipient',
    });
    expect(
      shielded?.find((item) => item.key === 'ironwood')?.spendableParsed,
    ).toBe('3');
    expect(
      withdrawal?.find((item) => item.key === 'ironwood')?.spendableParsed,
    ).toBe('1');
    // The transparent builder still uses the indexer, not the scan snapshot.
    expect(
      shielded?.find((item) => item.key === 'transparent')?.spendableParsed,
    ).toBe('5');
  });
});

describe('Zcash transparent send amount intent', () => {
  const txid = '11'.repeat(32);
  const fee = new OneKeyLocalError('Insufficient funds for amount plus fee');

  function createVault() {
    const quoteTransparentTx = jest.fn(
      async (params: IZcashTransparentTxRequest) => {
        if (!params.sendMax) throw fee;
        return {
          feeZat: '10000',
          sendAmountZat: '99990000',
          spentOutpoints: params.selectedOutpoints,
        };
      },
    );
    const vault: Vault = Object.assign(
      Object.create(Vault.prototype) as Vault,
      {
        accountId: 'test-account',
        backgroundApi: {
          simpleDb: {
            zcash: {
              getPrivacyModeState: async () => ({ intent: 'off' }),
              pruneExpiredTransparentState: jest.fn(),
            },
          },
        },
        validateAddress: async () => ({ isValid: true }),
        zcashFetchFreshTransparentUtxos: async () => ({
          account: {},
          accountIndex: 0,
          targetHeight: 3_000_000,
          utxos: [
            {
              txid,
              vout: 0,
              valueZat: '100000000',
              derivationPath: "m/44'/133'/0'/0/0",
            },
          ],
        }),
        zcashAssertNoUnresolvedBroadcastWithLifecycleLock: jest.fn(),
        zcashTransparentChange: async () => ({
          address: 't1-change',
          derivationPath: "m/44'/133'/0'/1/0",
        }),
        zcashGetApi: async () => ({ quoteTransparentTx }),
      },
    );
    return { vault, quoteTransparentTx };
  }

  it('does not deduct a fee from an exact transparent amount equal to the input total', async () => {
    const { vault, quoteTransparentTx } = createVault();
    await expect(
      vault.buildEncodedTx({
        transfersInfo: [{ from: 't1-from', to: 't1-recipient', amount: '1' }],
      }),
    ).rejects.toBe(fee);
    expect(quoteTransparentTx).toHaveBeenCalledWith(
      expect.objectContaining({
        sendMax: false,
        recipients: [{ address: 't1-recipient', amountZat: '100000000' }],
      }),
    );
  });

  it.each([false, true])(
    'quotes transparent funds to a Unified recipient with scanning disabled (Shield=%s)',
    async (shield) => {
      const { vault, quoteTransparentTx } = createVault();
      const encoded = await vault.buildEncodedTx({
        transfersInfo: [
          {
            from: 't1-from',
            to: 'u1-recipient',
            amount: '1',
            ...(shield ? { localWalletShield: true } : {}),
          },
        ],
        transferPayload: {
          amountToSend: '1',
          originalRecipient: 'u1-recipient',
          isMaxSend: true,
          isNFT: false,
        },
      });
      expect(encoded.zcashMode).toBe('transparent');
      expect(encoded.zcashAmountValue).toBe('99990000');
      expect(encoded.isShielding).not.toBe(true);
      expect(quoteTransparentTx).toHaveBeenCalledWith(
        expect.objectContaining({
          sendMax: true,
          selectedOutpoints: [{ txid, vout: 0 }],
          recipients: [{ address: 'u1-recipient' }],
        }),
      );
    },
  );

  it('uses the stateless transparent send-max path only for explicit Max', async () => {
    const { vault } = createVault();
    const encoded = await vault.buildEncodedTx({
      transfersInfo: [{ from: 't1-from', to: 't1-recipient', amount: '1' }],
      transferPayload: {
        amountToSend: '1',
        originalRecipient: 't1-recipient',
        isMaxSend: true,
        isNFT: false,
      },
    });
    expect(encoded.zcashAmountValue).toBe('99990000');
    expect(encoded.zcashTransparentPlan?.sendMax).toBe(true);
  });
});
