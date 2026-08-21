import {
  EParseTxComponentType,
  type IDisplayComponentAddress,
  type IDisplayComponentInternalAssets,
} from '../../types/signatureConfirm';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
  type IDecodedTx,
  type IDecodedTxTransferInfo,
} from '../../types/tx';
import { appLocale } from '../locale/appLocale';
import { ETranslations } from '../locale/enum/translations';

import {
  collectDecodedTxInvolvedAddresses,
  convertDecodedTxActionsToSignatureConfirmTxDisplayComponents,
} from './txActionUtils';

const defaultLocal = appLocale.intl.locale;
const defaultMessages = appLocale.intl.messages;

function buildTransfer(to: string): IDecodedTxTransferInfo {
  return {
    from: '0xsender',
    to,
    amount: '0.001',
    icon: '',
    name: 'Sui',
    symbol: 'SUI',
    tokenIdOnNetwork: '0x2::sui::SUI',
    isNative: true,
  };
}

function buildDecodedTx(transfers: IDecodedTxTransferInfo[]): IDecodedTx {
  return {
    txid: '',
    owner: '0xsender',
    signer: '0xsender',
    nonce: 0,
    actions: [
      {
        type: EDecodedTxActionType.ASSET_TRANSFER,
        assetTransfer: {
          from: '0xsender',
          to: '',
          sends: transfers,
          receives: [],
        },
      },
    ],
    status: EDecodedTxStatus.Pending,
    networkId: 'sui--mainnet',
    accountId: 'account-id',
    extraInfo: null,
  };
}

describe('txActionUtils', () => {
  beforeEach(() => {
    appLocale.setLocale('en-US', {
      [ETranslations.global_asset]: 'Asset',
      [ETranslations.global_to]: 'To',
    } as Parameters<typeof appLocale.setLocale>[1]);
  });

  afterEach(() => {
    appLocale.setLocale(defaultLocal, defaultMessages);
  });

  it('renders each outgoing recipient as an address component', () => {
    const components =
      convertDecodedTxActionsToSignatureConfirmTxDisplayComponents({
        decodedTx: buildDecodedTx([
          buildTransfer('0xrecipient1'),
          buildTransfer('0xrecipient2'),
        ]),
        unsignedTx: {} as never,
      });

    const assetComponents = components.filter(
      (component): component is IDisplayComponentInternalAssets =>
        component.type === EParseTxComponentType.InternalAssets,
    );
    const addressComponents = components.filter(
      (component): component is IDisplayComponentAddress =>
        component.type === EParseTxComponentType.Address,
    );

    expect(assetComponents).toHaveLength(2);
    expect(addressComponents.map((component) => component.address)).toEqual([
      '0xrecipient1',
      '0xrecipient2',
    ]);
  });

  it('deduplicates repeated outgoing recipients', () => {
    const components =
      convertDecodedTxActionsToSignatureConfirmTxDisplayComponents({
        decodedTx: buildDecodedTx([
          buildTransfer('0xrecipient1'),
          buildTransfer('0xrecipient1'),
        ]),
        unsignedTx: {} as never,
      });

    const addressComponents = components.filter(
      (component): component is IDisplayComponentAddress =>
        component.type === EParseTxComponentType.Address,
    );

    expect(addressComponents.map((component) => component.address)).toEqual([
      '0xrecipient1',
    ]);
  });
});

describe('collectDecodedTxInvolvedAddresses', () => {
  it('collects transfer from/to and utxo addresses deduped', () => {
    const decodedTx = buildDecodedTx([
      buildTransfer('0xrecipient1'),
      buildTransfer('0xrecipient1'),
    ]);
    const transfer = decodedTx.actions[0].assetTransfer;
    if (transfer) {
      transfer.receives = [
        { ...buildTransfer('0xsender'), from: '0xrecipient2' },
      ];
      transfer.utxoFrom = [
        {
          address: 'bc1q-input',
          balance: '1',
          balanceValue: '1',
          symbol: 'BTC',
          isMine: true,
        },
      ];
      transfer.utxoTo = [
        {
          address: 'bc1q-output',
          balance: '1',
          balanceValue: '1',
          symbol: 'BTC',
          isMine: false,
        },
      ];
    }

    expect(collectDecodedTxInvolvedAddresses({ decodedTx })).toEqual([
      '0xsender',
      '0xrecipient1',
      '0xrecipient2',
      'bc1q-input',
      'bc1q-output',
    ]);
  });

  it('returns empty array for txs without asset transfers', () => {
    const decodedTx = buildDecodedTx([]);
    decodedTx.actions = [{ type: EDecodedTxActionType.UNKNOWN }];
    expect(collectDecodedTxInvolvedAddresses({ decodedTx })).toEqual([]);
  });
});

describe('approve component scaled-UI handling', () => {
  const buildApproveDecodedTx = (balanceMultiplier?: string): IDecodedTx =>
    ({
      txid: '',
      owner: '0xowner',
      signer: '0xowner',
      networkId: 'evm--56',
      accountId: 'test-account',
      status: EDecodedTxStatus.Pending,
      actions: [
        {
          type: EDecodedTxActionType.TOKEN_APPROVE,
          tokenApprove: {
            from: '0xowner',
            to: '0xtoken',
            spender: '0xspender',
            amount: '100.06',
            icon: '',
            name: 'Apple (bStocks)',
            symbol: 'AAPLB',
            decimals: 18,
            tokenIdOnNetwork: '0xtoken',
            isInfiniteAmount: false,
            balanceMultiplier,
          },
        },
      ],
    }) as unknown as IDecodedTx;

  it('fails closed (not editable) and carries the multiplier for scaling tokens', () => {
    const components =
      convertDecodedTxActionsToSignatureConfirmTxDisplayComponents({
        decodedTx: buildApproveDecodedTx('1.0006'),
        unsignedTx: { encodedTx: {} } as any,
      });
    const approve = components.find(
      (c: any) => c.type === EParseTxComponentType.Approve,
    ) as any;
    expect(approve).toBeDefined();
    expect(approve.isEditable).toBe(false);
    expect(approve.token.info.balanceMultiplier).toBe('1.0006');
    expect(approve.amountParsed).toBe('100.06');
  });

  it('stays editable for multiplier === 1 (documented no-op)', () => {
    const components =
      convertDecodedTxActionsToSignatureConfirmTxDisplayComponents({
        decodedTx: buildApproveDecodedTx('1'),
        unsignedTx: { encodedTx: {} } as any,
      });
    const approve = components.find(
      (c: any) => c.type === EParseTxComponentType.Approve,
    ) as any;
    expect(approve.isEditable).toBe(true);
  });

  it('stays editable when no multiplier is present', () => {
    const components =
      convertDecodedTxActionsToSignatureConfirmTxDisplayComponents({
        decodedTx: buildApproveDecodedTx(undefined),
        unsignedTx: { encodedTx: {} } as any,
      });
    const approve = components.find(
      (c: any) => c.type === EParseTxComponentType.Approve,
    ) as any;
    expect(approve.isEditable).toBe(true);
  });

  it('stays editable for an invalid multiplier sentinel', () => {
    // Server sentinels ('--', '0') mean the decode-side conversion was a
    // passthrough, so amountParsed is raw and editing stays safe/enabled.
    const components =
      convertDecodedTxActionsToSignatureConfirmTxDisplayComponents({
        decodedTx: buildApproveDecodedTx('--'),
        unsignedTx: { encodedTx: {} } as any,
      });
    const approve = components.find(
      (c: any) => c.type === EParseTxComponentType.Approve,
    ) as any;
    expect(approve.isEditable).toBe(true);
    expect(approve.token.info.balanceMultiplier).toBe('--');
  });
});
