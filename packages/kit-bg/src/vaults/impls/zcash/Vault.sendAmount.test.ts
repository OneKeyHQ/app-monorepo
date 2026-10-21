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
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';

import Vault from './Vault';

const originalIntl = appLocale.intl;
beforeAll(async () => {
  appLocale.setLocale('en-US', await loadLocaleMessages('en-US'));
});
afterAll(() => {
  appLocale.setLocale(originalIntl.locale, originalIntl.messages);
});

function pool(spendable: string): IZcashPoolDetail {
  return {
    spendable,
    total: spendable,
    pendingChange: '0',
    pendingSpendable: '0',
    locked: '0',
  };
}

// The scanner snapshot is shielded-only; `transparentForTest` feeds the
// indexer mock so each case states its transparent funds at the call site.
type ITestBalance = IZcashBalance & { transparentForTest: string };

function balance(
  ironwood: string,
  transparent: string,
  orchard = '0',
): ITestBalance {
  const shielded = String(BigInt(ironwood) + BigInt(orchard));
  return {
    isComplete: true,
    shielded,
    spendable: shielded,
    pendingChange: '0',
    pendingSpendable: '0',
    orchardBalance: orchard,
    ironwoodBalance: ironwood,
    shieldedSpendable: shielded,
    poolsDetail: {
      ironwood: pool(ironwood),
      orchard: pool(orchard),
    },
    transparentForTest: transparent,
  };
}

describe('Zcash send amount intent', () => {
  function createVault(snapshot: IZcashBalance | null) {
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
              }),
            },
          },
          serviceAccount: { getDBAccount: async () => account },
        },
        zcashGetApi: async () => ({ quotePczt }),
        zcashGetWalletAccount: async () => account,
        zcashGetBalanceSafe: async () => snapshot,
        getLocalWalletBalance: async () => snapshot,
        // The public half is indexer-owned; drive it from the same fixture.
        zcashGetIndexerTransparentBalance: async () => {
          const transparent = new BigNumber(
            (snapshot as ITestBalance | null)?.transparentForTest ??
              '500000000',
          );
          return {
            total: transparent,
            spendable: transparent,
          };
        },
      },
    );
    return {
      vault,
      quotePczt,
    };
  }

  // The private pools stay listed without a balance, so the page can offer a
  // retry instead of silently defaulting to transparent.
  it('keeps indexer funds spendable when the privacy scanner is unavailable', async () => {
    const { vault } = createVault(null);
    const pools = await vault.listLocalWalletSendPools({
      accountId: 'test-account',
      toAddress: 'u1-recipient',
    });
    expect(pools).toEqual([
      expect.objectContaining({ key: 'ironwood', isDefault: true }),
      expect.objectContaining({ key: 'orchard' }),
      expect.objectContaining({
        key: 'transparent',
        spendable: '500000000',
        eligible: true,
      }),
    ]);
    expect(pools?.[0].spendable).toBeUndefined();
    expect(pools?.[1].spendable).toBeUndefined();
  });

  // ZIP-320: exchanges' TEX deposit addresses take transparent funds only.
  it('offers only transparent funds for a TEX recipient', async () => {
    const { vault } = createVault(balance('100000000', '0'));
    const pools = await vault.listLocalWalletSendPools({
      accountId: 'test-account',
      toAddress: 'tex1pyysjzgfpyysjzgfpyysjzgfpyysjzgfl7c006',
    });
    expect(
      pools?.filter((item) => item.eligible !== false).map((item) => item.key),
    ).toEqual(['transparent']);
    expect(pools?.find((item) => item.key === 'transparent')).toMatchObject({
      isDefault: true,
    });
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

  // A private source spends its own pool only: the figure the amount page
  // showed is exactly what Max sends.
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
        valueZat: '99990000',
      }),
    );
    expect(quotePczt.mock.calls[0][1]).not.toHaveProperty('spendTransparent');
  });

  // Stored unmined sends already hold their notes; Max quotes without a
  // confirmation-screen reservation sweep.
  it('does not wait on an unconfirmed send before quoting the max', async () => {
    const { vault, quotePczt } = createVault(balance('100000000', '0'));

    await vault.buildEncodedTx(request('1', true));

    expect(quotePczt).toHaveBeenCalled();
  });

  it('spends the difference when the quote comes in under the first guess', async () => {
    const { vault, quotePczt } = createVault(balance('100000000', '0'));
    quotePczt.mockResolvedValue({ feeZat: '5000' });

    const encoded = await vault.buildEncodedTx(request('1', true));

    // Keeping the guess would have left 5000 zat of the user's money behind.
    expect(encoded.zcashAmountValue).toBe('99995000');
    expect(quotePczt).toHaveBeenCalledTimes(2);
  });

  it('keeps the affordable amount when the larger one prices higher', async () => {
    const { vault, quotePczt } = createVault(balance('100000000', '0'));
    quotePczt
      .mockResolvedValueOnce({ feeZat: '5000' })
      .mockResolvedValue({ feeZat: '20000' });

    const encoded = await vault.buildEncodedTx(request('1', true));

    // The first candidate was quoted and affordable; a re-quote that prices
    // higher must not replace it with a smaller one.
    expect(encoded.zcashAmountValue).toBe('99990000');
  });

  it('localizes insufficient funds below the fee and keeps the shortfall', async () => {
    const { vault } = createVault(balance('4000', '0'));

    await expect(
      vault.buildEncodedTx(request('1', true)),
    ).rejects.toMatchObject({
      message: 'Insufficient ZEC balance',
      key: ETranslations.send_error_insufficient_balance,
      params: { shortfallZat: 6000 },
    });
  });

  it('keeps the last reported shortfall when the probe never converges', async () => {
    const { vault, quotePczt } = createVault(balance('100000000', '0'));
    quotePczt.mockRejectedValue(
      Object.assign(new OneKeyLocalError('probe'), {
        code: 'INSUFFICIENT_FUNDS',
        params: { shortfallZat: 7000 },
      }),
    );

    await expect(
      vault.buildEncodedTx(request('1', true)),
    ).rejects.toMatchObject({
      message: 'Insufficient ZEC balance',
      key: ETranslations.send_error_insufficient_balance,
      params: { shortfallZat: 7000 },
    });
  });

  // The send page lists transparent as the default for a transparent
  // recipient; a request that names no pool must build the same thing.
  it('pays a transparent recipient from transparent funds when no pool is named', async () => {
    const { vault } = createVault(balance('100000000', '200000000'));
    const zcashBuildTransparentEncodedTx = jest.fn(async () => ({
      zcashMode: 'transparent',
    }));
    Object.assign(vault, { zcashBuildTransparentEncodedTx });
    await vault.buildEncodedTx({
      transfersInfo: [{ from: 't1-from', to: 't1-recipient', amount: '1' }],
    } as never);
    expect(zcashBuildTransparentEncodedTx).toHaveBeenCalled();
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
        expect.objectContaining({ spendSource: source }),
      );
    },
  );

  it('does not silently use an entered amount when Max has no reliable balance', async () => {
    const { vault } = createVault(null);
    await expect(
      vault.buildEncodedTx(request('1', true)),
    ).rejects.toMatchObject({ code: 'NOT_SYNCED' });
  });

  // Each pool shows its own funds: that figure is exactly what Max sends.
  it('shows each pool its own spendable, whatever the recipient', async () => {
    const { vault } = createVault(balance('100000000', '200000000'));
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
    ).toBe('1');
    expect(
      withdrawal?.find((item) => item.key === 'ironwood')?.spendableParsed,
    ).toBe('1');
    expect(
      shielded?.find((item) => item.key === 'transparent')?.spendableParsed,
    ).toBe('2');
  });
  it('keeps memo bytes in the reviewed private transaction and Max quote', async () => {
    const { vault, quotePczt } = createVault(balance('100000', '0'));
    const memoHex = `ff000102${'00'.repeat(508)}`;
    const tx = await vault.buildEncodedTx({
      transfersInfo: [
        {
          to: 'u1-recipient',
          from: '',
          amount: '0.0001',
          localWalletSourcePool: 'ironwood',
          zcashMemoHex: memoHex,
        },
      ],
      transferPayload: {
        isMaxSend: true,
        amountToSend: '0.0001',
        isNFT: false,
        originalRecipient: 'u1-recipient',
      },
    });
    expect(tx.zcashMemoHex).toBe(memoHex);
    expect(quotePczt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ memoHex }),
    );
  });
  it('rejects memo for transparent recipients before selecting funds', async () => {
    const { vault, quotePczt } = createVault(balance('100000', '0'));
    await expect(
      vault.buildEncodedTx({
        transfersInfo: [
          {
            to: 't1-recipient',
            from: '',
            amount: '0.0001',
            zcashMemoHex: `ff${'00'.repeat(511)}`,
          },
        ],
      }),
    ).rejects.toThrow(
      appLocale.intl.formatMessage({
        id: ETranslations.privacy_memo_shielded_only__msg,
      }),
    );
    expect(quotePczt).not.toHaveBeenCalled();
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
            privacyChain: {},
            zcash: {
              getPrivacyModeState: async () => ({ intent: 'off' }),
              listTransparentPendingTxs: async () => [],
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
