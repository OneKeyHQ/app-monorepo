import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  EParseTxComponentRole,
  EParseTxComponentType,
  type IDisplayComponentAddress,
} from '@onekeyhq/shared/types/signatureConfirm';
import {
  EProtocolOfExchange,
  type ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
  type IDecodedTx,
} from '@onekeyhq/shared/types/tx';

import { fixPrivateSendRecipientDisplay } from './ServiceSignatureConfirm';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

const defaultLocal = appLocale.intl.locale;
const defaultMessages = appLocale.intl.messages;

const originalRecipient = '0xrecipient';
const payinAddress = '0xpayin';

function buildAddressComponent({
  address,
  label,
  role,
}: {
  address: string;
  label: string;
  role?: EParseTxComponentRole;
}): IDisplayComponentAddress {
  return {
    type: EParseTxComponentType.Address,
    role,
    label,
    address,
    tags: [],
  };
}

function buildDecodedTx(components: IDisplayComponentAddress[]): IDecodedTx {
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
          to: payinAddress,
          sends: [
            {
              from: '0xsender',
              to: payinAddress,
              amount: '1',
              icon: '',
              name: 'Sui',
              symbol: 'SUI',
              tokenIdOnNetwork: '0x2::sui::SUI',
              isNative: true,
            },
          ],
          receives: [],
        },
      },
    ],
    status: EDecodedTxStatus.Pending,
    networkId: 'sui--mainnet',
    accountId: 'account-id',
    extraInfo: null,
    txDisplay: {
      title: '',
      alerts: [],
      components,
    },
  };
}

function buildUnsignedTx(): IUnsignedTxPro {
  return {
    swapInfo: {
      protocol: EProtocolOfExchange.PRIVATE_SEND,
      receivingAddress: originalRecipient,
      swapBuildResData: {
        changellyOrder: {
          payinAddress,
        },
      },
    } as ISwapTxInfo,
  } as IUnsignedTxPro;
}

function buildTransferPayload(): NonNullable<
  Parameters<typeof fixPrivateSendRecipientDisplay>[0]['transferPayload']
> {
  return {
    isPrivateSend: true,
    originalRecipient,
    privateSend: {
      payinAddress,
    },
  } as NonNullable<
    Parameters<typeof fixPrivateSendRecipientDisplay>[0]['transferPayload']
  >;
}

describe('fixPrivateSendRecipientDisplay', () => {
  beforeEach(() => {
    appLocale.setLocale('en-US', {
      [ETranslations.global_to]: 'To',
      [ETranslations.private_send_private_send]: 'Private Send',
      [ETranslations.swap_history_detail_received_address]: 'Received address',
    } as Parameters<typeof appLocale.setLocale>[1]);
  });

  afterEach(() => {
    appLocale.setLocale(defaultLocal, defaultMessages);
  });

  it('removes the payin address row when the private send receiver is already shown', () => {
    const decodedTx = buildDecodedTx([
      buildAddressComponent({
        label: 'Received address',
        address: originalRecipient,
        role: EParseTxComponentRole.SwapReceiver,
      }),
      buildAddressComponent({
        label: 'Interact with',
        address: payinAddress,
      }),
    ]);

    fixPrivateSendRecipientDisplay({
      decodedTx,
      unsignedTx: buildUnsignedTx(),
      transferPayload: buildTransferPayload(),
    });

    const addressComponents = decodedTx.txDisplay?.components.filter(
      (component): component is IDisplayComponentAddress =>
        component.type === EParseTxComponentType.Address,
    );

    expect(addressComponents).toEqual([
      expect.objectContaining({
        role: EParseTxComponentRole.SwapReceiver,
        address: originalRecipient,
        label: 'Received address',
      }),
    ]);
  });

  it('keeps the fallback recipient display when no receiver row exists', () => {
    const decodedTx = buildDecodedTx([
      buildAddressComponent({
        label: 'Interact with',
        address: payinAddress,
      }),
    ]);

    fixPrivateSendRecipientDisplay({
      decodedTx,
      unsignedTx: buildUnsignedTx(),
      transferPayload: buildTransferPayload(),
    });

    const addressComponents = decodedTx.txDisplay?.components.filter(
      (component): component is IDisplayComponentAddress =>
        component.type === EParseTxComponentType.Address,
    );

    expect(addressComponents).toEqual([
      expect.objectContaining({
        address: originalRecipient,
        label: 'To',
        isNavigable: false,
        highlight: true,
      }),
    ]);
  });
});
