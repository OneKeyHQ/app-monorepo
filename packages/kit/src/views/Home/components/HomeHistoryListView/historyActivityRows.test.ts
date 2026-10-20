import { createIntl, createIntlCache } from 'react-intl';

import { getTxActionTransferInfo } from '@onekeyhq/kit/src/components/TxAction/TxActionTransfer';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import {
  EApproveType,
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type { IDecodedTxTransferInfo } from '@onekeyhq/shared/types/tx';

import {
  buildHistoryActivityRow,
  formatHistoryNumber,
} from './historyActivityRows';

jest.mock('@onekeyhq/kit/src/components/AddressInfo', () => ({}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({}));
jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({}));
jest.mock('@onekeyhq/kit/src/components/TxAction/TxActionCommon', () => ({}));
jest.mock('@onekeyhq/kit/src/components/TxAction/TxActionSwapInfo', () => ({}));
jest.mock('@onekeyhq/kit/src/views/ApproveEditor', () => ({}));
jest.mock(
  '@onekeyhq/kit/src/views/AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem',
  () => ({}),
);
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

const intl = createIntl(
  { locale: 'en-US', onError: () => {} },
  createIntlCache(),
);
const transfer = (amount: string): IDecodedTxTransferInfo => ({
  amount,
  tokenIdOnNetwork: 'btc',
  symbol: 'BTC',
  icon: '',
  name: 'Bitcoin',
  from: 'a',
  to: 'b',
  price: '2',
  isNative: true,
  isNFT: false,
});
function history(
  sends: ReturnType<typeof transfer>[],
  receives: ReturnType<typeof transfer>[],
): IAccountHistoryTx {
  return {
    id: 'tx',
    decodedTx: {
      accountId: 'hd--account',
      networkId: 'btc--0',
      txid: 'tx',
      status: EDecodedTxStatus.Confirmed,
      nativeAmount: '3',
      payload: { type: EOnChainHistoryTxType.Send },
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: { from: 'a', to: 'b', sends, receives },
        },
      ],
    },
  } as unknown as IAccountHistoryTx;
}
const row = (tx: IAccountHistoryTx, tableLayout = true, isUTXO = true) =>
  buildHistoryActivityRow({
    history: tx,
    tableLayout,
    isUTXO,
    hideValue: false,
    currency: '$',
    intl,
  }).row;

describe('Home native history financial display parity', () => {
  it.each([true, false])(
    'does not display an unknown private payment or derived fiat in table layout %s',
    (tableLayout) => {
      const tx = history([{ ...transfer('1.00003'), isNative: true }], []);
      tx.decodedTx.nativeAmountIsUnknown = true;
      const result = row(tx, tableLayout, false);
      expect(result.amounts).toHaveLength(1);
      expect(result.amounts[0]).toMatchObject({
        text: ETranslations.global_not_available,
      });
      expect(result.amounts[0].secondaryText).toBeUndefined();
    },
  );

  it('keeps known token values when the native payment is unknown', () => {
    const tx = history(
      [
        { ...transfer('1.00003'), isNative: true },
        {
          ...transfer('7'),
          tokenIdOnNetwork: 'other',
          symbol: 'TOKEN',
          isNative: false,
        },
      ],
      [],
    );
    tx.decodedTx.nativeAmountIsUnknown = true;
    const result = row(tx, true, false);
    expect(result.amounts[0].text).toBe(ETranslations.global_not_available);
    expect(result.amounts[1].text).toContain('7');
  });
  it.each([true, false])(
    'marks failed and dropped rows in table layout %s',
    (tableLayout) => {
      for (const status of [
        EDecodedTxStatus.Failed,
        EDecodedTxStatus.Dropped,
        EDecodedTxStatus.Confirmed,
      ]) {
        const tx = history([transfer('7')], []);
        tx.decodedTx.status = status;
        const result = row(tx, tableLayout);
        expect(result.disabled).not.toBe(true);
        expect(result.key).toBe('tx');
        expect(result.presentation).toBe(tableLayout ? 'table' : 'stacked');
        expect(result.badges).toEqual(
          status === EDecodedTxStatus.Confirmed
            ? []
            : [
                {
                  key: 'failed',
                  text: ETranslations.global_failed,
                  tone: 'danger',
                },
              ],
        );
      }
    },
  );

  it('keeps a pure UTXO send amount instead of substituting nativeAmount', () => {
    expect(row(history([transfer('7')], [])).amounts[0].text).toContain('7');
  });
  it('uses net nativeAmount for a UTXO send with a change receive', () => {
    const tx = history(
      [transfer('7')],
      [{ ...transfer('4'), from: 'c', to: 'a' }],
    );
    expect(row(tx).amounts[0].text).toContain('3');
  });
  it('keeps six expanded lines and collapses seven into five plus overflow', () => {
    const transfers = Array.from({ length: 7 }, (_, index) => ({
      ...transfer('1'),
      tokenIdOnNetwork: `token-${index}`,
    }));
    expect(row(history(transfers.slice(0, 6), [])).amounts).toHaveLength(6);
    const many = row(history(transfers, []));
    expect(many.amounts).toHaveLength(6);
    expect(many.amounts[5].key).toBe('overflow');
  });
  it('masks balances while retaining symbols and masks fiat without currency', () => {
    expect(
      formatHistoryNumber('123', {
        balance: true,
        symbol: 'BTC',
        hideValue: true,
      }).text,
    ).toBe('**** BTC');
    expect(
      formatHistoryNumber('123', { currency: '$', hideValue: true }).text,
    ).toBe('****');
  });
  it('lets a receive-only transfer take precedence over a UTXO payload send label', () => {
    const result = row(history([], [transfer('7')]));
    expect(result.amounts[0].text).toContain('+7');
  });
  it('uses two token images for mixed-direction phone rows and keeps network overlays on each', () => {
    const tx = history(
      [{ ...transfer('2'), icon: 'https://example.com/send.png' }],
      [
        {
          ...transfer('1'),
          tokenIdOnNetwork: 'eth',
          icon: 'https://example.com/receive.png',
        },
      ],
    );
    tx.decodedTx.networkLogoURI = 'https://example.com/network.png';
    const result = buildHistoryActivityRow({
      history: tx,
      intl,
      tableLayout: false,
      isUTXO: false,
      hideValue: false,
      currency: '$',
      isAllNetworks: true,
    }).row;
    expect(result.leading).toMatchObject({
      kind: 'token',
      networkImage: { uri: tx.decodedTx.networkLogoURI },
    });
    expect(result.secondaryLeading).toMatchObject({
      kind: 'token',
      networkImage: { uri: tx.decodedTx.networkLogoURI },
    });
    expect(result.amounts.map((amount) => amount.text)).toEqual([
      expect.stringContaining('+1'),
      expect.stringContaining('-2'),
    ]);
  });
  it('adds a fetched network badge without changing the history row key', () => {
    const tx = history([transfer('2')], []);
    const params = {
      history: tx,
      intl,
      tableLayout: true,
      hideValue: false,
      currency: '$',
      isAllNetworks: true,
    };
    const initial = buildHistoryActivityRow(params).row;
    const updated = buildHistoryActivityRow({
      ...params,
      networkBadge: { logoURI: 'https://example.com/network.png' },
    }).row;
    expect(initial.leading).not.toHaveProperty('networkImage');
    expect(updated.key).toBe(initial.key);
    expect(updated.leading).toMatchObject({
      networkImage: { uri: 'https://example.com/network.png' },
    });
  });
  it('uses a text overlay for a custom network without a logo', () => {
    const result = buildHistoryActivityRow({
      history: history([transfer('2')], []),
      intl,
      tableLayout: true,
      hideValue: false,
      currency: '$',
      isAllNetworks: true,
      networkBadge: { letter: 'C' },
    }).row;
    expect(result.leading).toMatchObject({
      overlays: [{ position: 'bottomRight', text: 'C' }],
    });
  });
  it('preserves token symbols when privacy masking is enabled', () => {
    const result = buildHistoryActivityRow({
      history: history([transfer('7')], []),
      intl,
      tableLayout: false,
      isUTXO: false,
      hideValue: true,
      currency: '$',
    }).row;
    expect(result.amounts.map((amount) => amount.text)).toEqual([
      '**** BTC',
      '****',
    ]);
  });
  it('retains the document fallback for unknown transaction actions', () => {
    const tx = history([], []);
    tx.decodedTx.actions = [
      {
        type: EDecodedTxActionType.UNKNOWN,
        unknownAction: { from: 'a', to: 'b' },
      },
    ] as typeof tx.decodedTx.actions;
    expect(row(tx, false).leading).toMatchObject({
      fallbackIcon: { name: 'Document2Outline' },
    });
  });
  it('does not classify a zero-value increase allowance as revoke', () => {
    const tx = history([], []);
    tx.decodedTx.actions = [
      {
        type: EDecodedTxActionType.TOKEN_APPROVE,
        tokenApprove: {
          amount: '0',
          symbol: 'BTC',
          name: 'Bitcoin',
          approveType: EApproveType.IncreaseAllowance,
          spender: 'b',
        },
      },
    ] as typeof tx.decodedTx.actions;
    const result = row(tx, false);
    expect(result.title).toBe(ETranslations.approve_edit_increase_allowance);
    expect(result.amounts[1].text).toContain('+0');
  });
  it.each([
    [EApproveType.Approve, true],
    [EApproveType.IncreaseAllowance, false],
    [EApproveType.IncreaseApproval, false],
  ])(
    'renders unlimited %s as text with the legacy layout and privacy rules',
    (approveType, isInfiniteAmount) => {
      const tx = history([], []);
      tx.decodedTx.actions = [
        {
          type: EDecodedTxActionType.TOKEN_APPROVE,
          tokenApprove: {
            amount: 'Infinite',
            symbol: 'BTC',
            name: 'Bitcoin',
            approveType,
            isInfiniteAmount,
            spender: 'b',
          },
        },
      ] as typeof tx.decodedTx.actions;
      const unlimitedText = intl.formatMessage({
        id: ETranslations.swap_page_provider_approve_amount_un_limit,
      });
      for (const hideValue of [false, true]) {
        for (const tableLayout of [false, true]) {
          const result = buildHistoryActivityRow({
            history: tx,
            intl,
            tableLayout,
            isUTXO: false,
            hideValue,
            currency: '$',
          }).row;
          let expectedText = unlimitedText;
          if (tableLayout) expectedText = `${unlimitedText} BTC`;
          else if (hideValue) expectedText = '**** BTC';
          expect(
            result.amounts.find((amount) => amount.key === 'approval'),
          ).toMatchObject({
            text: expectedText,
          });
        }
      }
    },
  );
  it('adds a distinct private-send creation fee and preserves the private recipient', () => {
    const tx = history([{ ...transfer('7'), tokenIdOnNetwork: 'usdc' }], []);
    tx.decodedTx.payload = {
      ...tx.decodedTx.payload,
      type: EOnChainHistoryTxType.PrivateSend,
      privateSend: { originalRecipient: 'private-recipient' },
    } as typeof tx.decodedTx.payload;
    tx.decodedTx.extraInfo = {
      createTokenAccountFee: { amount: '0.01', symbol: 'SOL' },
    } as typeof tx.decodedTx.extraInfo;
    const result = buildHistoryActivityRow({
      history: tx,
      intl,
      tableLayout: true,
      isUTXO: false,
      hideValue: false,
      currency: '$',
    });
    expect(result.address).toBe('private-recipient');
    expect(result.row.amounts).toHaveLength(2);
    expect(result.row.amounts[1].text).toContain('0.01');
  });
  it('isolates malformed transaction rows instead of crashing the entire native list', () => {
    const tx = history([], []);
    tx.decodedTx.actions = [];
    expect(row(tx).disabled).toBe(true);
  });
});

describe('Home history shielded endpoints', () => {
  const T1 = `t1${'A'.repeat(33)}`;
  const U1 = `u1${'q'.repeat(90)}`;
  const localWallet = {
    pools: [
      { id: 0, kind: 'public' as const, label: 'Transparent' },
      { id: 4, kind: 'private' as const, label: 'Ironwood' },
    ],
    hiddenEndpointLabelId: ETranslationsMock.privacy_history_shielded__label,
    publicAddressPattern: '^t[13][1-9A-HJ-NP-Za-km-z]{33}$',
    privateAddressPattern: '^u1[02-9ac-hj-np-z]+$',
  };
  const shieldedRow = ({
    side,
    marker,
    address = '',
    settings = localWallet,
    addresses,
  }: {
    side: 'from' | 'to';
    marker?: { poolId?: number; isOwn?: boolean };
    address?: string;
    settings?: typeof localWallet;
    addresses?: { publicAddress?: string; privateAddress?: string };
  }) => {
    const entry = {
      ...transfer('1'),
      from: side === 'from' ? address : T1,
      to: side === 'to' ? address : T1,
      ...(side === 'from' ? { shieldedFrom: marker } : { shieldedTo: marker }),
    };
    const tx = history(
      side === 'to' ? [entry] : [],
      side === 'from' ? [entry] : [],
    );
    return buildHistoryActivityRow({
      history: tx,
      tableLayout: false,
      isUTXO: false,
      localWallet: settings,
      localWalletAddresses: addresses,
      hideValue: false,
      currency: '$',
      intl,
    });
  };

  it('names a hidden counterparty by pool and never looks it up as an address', () => {
    const result = shieldedRow({ side: 'from', marker: { poolId: 4 } });
    expect(result.address).toBe('');
    expect(result.row.description).toBe('Ironwood pool');
  });

  it("uses the chain's own name when the counterparty's pool is unknown", () => {
    expect(shieldedRow({ side: 'to', marker: {} }).row.description).toBe(
      'Shielded',
    );
    expect(
      shieldedRow({
        side: 'to',
        marker: {},
        settings: {
          ...localWallet,
          hiddenEndpointLabelId:
            ETranslationsMock.privacy_history_private__label,
        },
      }).row.description,
    ).toBe('Private');
  });

  it('names our spending side by pool, never filling in the displayed address', () => {
    const own = { poolId: 4, isOwn: true };
    const scanning = shieldedRow({
      side: 'from',
      marker: own,
      addresses: { publicAddress: T1, privateAddress: U1 },
    });
    expect(scanning.address).toBe('');
    expect(scanning.row.description).toBe('Ironwood pool');
    const notScanning = shieldedRow({
      side: 'from',
      marker: own,
      addresses: { publicAddress: T1 },
    });
    expect(notScanning.address).toBe('');
    expect(notScanning.row.description).toBe('Ironwood pool');
  });

  it('never claims which own address a note reached when the row cannot tell', () => {
    const result = shieldedRow({
      side: 'to',
      marker: { poolId: 4, isOwn: true },
      addresses: { publicAddress: T1, privateAddress: U1 },
    });
    expect(result.address).toBe('');
    expect(result.row.description).toBe('Ironwood pool');
  });

  it('shows our transparent address only when it is the displayed one', () => {
    const own = (addresses: { publicAddress?: string }) => {
      const tx = history([{ ...transfer('1'), from: T1, to: T1 }], []);
      tx.decodedTx.owner = T1;
      return buildHistoryActivityRow({
        history: tx,
        tableLayout: false,
        isUTXO: false,
        localWallet,
        localWalletAddresses: addresses,
        hideValue: false,
        currency: '$',
        intl,
      });
    };
    expect(own({ publicAddress: T1 }).address).toBe(T1);
    const mismatch = own({ publicAddress: `t1${'C'.repeat(33)}` });
    expect(mismatch.address).toBe('');
    expect(mismatch.row.description).toBe('Transparent pool');
  });

  it('names a row whose target is our own change address by pool', () => {
    const change = `t1${'H'.repeat(33)}`;
    const tx = history(
      [{ ...transfer('1'), from: T1, to: '', isOwn: true }],
      [{ ...transfer('1'), from: '', to: change, isOwn: true }],
    );
    tx.decodedTx.owner = T1;
    const result = buildHistoryActivityRow({
      history: tx,
      tableLayout: false,
      isUTXO: true,
      localWallet,
      localWalletAddresses: { publicAddress: T1, privateAddress: U1 },
      hideValue: false,
      currency: '$',
      intl,
    });
    expect(result.address).toBe('');
    expect(result.row.description).toBe('Transparent pool');
  });

  it('shows a transparent multi-address count as text, on BTC as before', () => {
    const count = intl.formatMessage(
      { id: ETranslations.global_count_addresses },
      { count: 2 },
    );
    const tx = history(
      [
        { ...transfer('1'), from: `t1${'B'.repeat(33)}` },
        { ...transfer('1'), from: `t1${'C'.repeat(33)}` },
      ],
      [{ ...transfer('2'), to: T1, isOwn: true }],
    );
    tx.decodedTx.payload = {
      type: EOnChainHistoryTxType.Receive,
      value: '2',
      label: '',
    };
    const build = (settings?: typeof localWallet) =>
      buildHistoryActivityRow({
        history: tx,
        tableLayout: false,
        isUTXO: true,
        localWallet: settings,
        localWalletAddresses: { publicAddress: T1 },
        hideValue: false,
        currency: '$',
        intl,
      });
    // The list row reads the same flag.
    expect(
      getTxActionTransferInfo({
        action: tx.decodedTx.actions[0],
        decodedTx: tx.decodedTx,
        isUTXO: true,
        intl,
      }),
    ).toMatchObject({ transferTarget: count, transferTargetIsCount: true });
    const zcash = build(localWallet);
    expect(zcash.address).toBe('');
    expect(zcash.row.description).toBe(count);
    expect(build().address).toBe(count);
  });

  it('shows the Monero primary address only while Receive shows it', () => {
    const primary = `4${'A'.repeat(94)}`;
    const monero = {
      pools: [{ id: 1, kind: 'private' as const, label: 'Monero' }],
      hiddenEndpointLabelId: ETranslationsMock.privacy_history_private__label,
      publicAddressPattern: '^$',
      privateAddressPattern: '^[1-9A-HJ-NP-Za-km-z]{95}$',
      addressForms: {
        privateLabel: ETranslations.privacy_receive_private_address__title,
      },
    };
    const toSelf = (addresses: {
      publicAddress?: string;
      privateAddress?: string;
    }) => {
      const tx = history(
        [{ ...transfer('1'), from: primary, to: primary, isOwn: true }],
        [],
      );
      tx.decodedTx.owner = primary;
      return buildHistoryActivityRow({
        history: tx,
        tableLayout: false,
        isUTXO: false,
        localWallet: monero,
        localWalletAddresses: addresses,
        hideValue: false,
        currency: '$',
        intl,
      });
    };
    expect(
      toSelf({ publicAddress: primary, privateAddress: primary }).address,
    ).toBe(primary);
    const paused = toSelf({ publicAddress: primary });
    expect(paused.address).toBe('');
    expect(paused.row.description).toBe('Private');
  });

  it('shows an exactly known recipient', () => {
    const result = shieldedRow({ side: 'to', address: U1 });
    expect(result.address).toBe(U1);
  });

  it('keeps an ordinary address description unchanged', () => {
    const tx = history([transfer('1')], []);
    const plain = buildHistoryActivityRow({
      history: tx,
      tableLayout: false,
      isUTXO: true,
      hideValue: false,
      currency: '$',
      intl,
    });
    expect(plain.address).toBe('b');
    expect(plain.row.description).toBe('b');
    const zcash = shieldedRow({ side: 'to', address: T1 });
    expect(zcash.address).toBe(T1);
  });
});
