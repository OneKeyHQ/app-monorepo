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

import { convertDecodedTxActionsToSignatureConfirmTxDisplayComponents } from './txActionUtils';

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
