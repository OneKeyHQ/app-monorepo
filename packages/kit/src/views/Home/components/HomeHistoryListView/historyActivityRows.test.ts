import { createIntl, createIntlCache } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import {
  EApproveType,
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

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
const transfer = (amount: string) => ({
  amount,
  tokenIdOnNetwork: 'btc',
  symbol: 'BTC',
  icon: '',
  name: 'Bitcoin',
  from: 'a',
  to: 'b',
  price: '2',
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
