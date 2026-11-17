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
  checkDecodedTxHasScalingBalanceMultiplier,
  collectDecodedTxInvolvedAddresses,
  convertDecodedTxActionsToSignatureConfirmTxDisplayComponents,
  mergeServerAddressRiskTagsIntoComponents,
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
      [ETranslations.receive_address__title]: 'Receiving address',
      [ETranslations.wallet_no_address]: 'No address',
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

  describe('UTXO output that has no address', () => {
    const P2PK_ASM = `${'02'.padEnd(66, 'a')} OP_CHECKSIG`;
    // pay-to-pubkey carrying the value, then a small output to an address
    const buildScriptPayment = (): IDecodedTx =>
      buildDecodedTx([
        { ...buildTransfer(''), toScript: P2PK_ASM },
        buildTransfer('bc1decoy'),
        { ...buildTransfer(''), toScript: P2PK_ASM },
      ]);
    const recipientRows = (isUTXO: boolean) =>
      convertDecodedTxActionsToSignatureConfirmTxDisplayComponents({
        decodedTx: buildScriptPayment(),
        unsignedTx: {} as never,
        isUTXO,
      })
        .filter(
          (component): component is IDisplayComponentAddress =>
            component.type === EParseTxComponentType.Address,
        )
        .map(({ label, address, tags, highlight }) => ({
          label,
          address,
          tags,
          highlight,
        }));

    it('lists the script as a recipient, in output order, marked as no address', () => {
      expect(recipientRows(true)).toEqual([
        {
          label: 'To',
          address: P2PK_ASM,
          tags: [{ value: 'No address', displayType: 'warning' }],
          highlight: undefined,
        },
        { label: 'To', address: 'bc1decoy', tags: [], highlight: true },
      ]);
    });

    it('lists an empty script as a recipient too', () => {
      const components =
        convertDecodedTxActionsToSignatureConfirmTxDisplayComponents({
          decodedTx: buildDecodedTx([
            { ...buildTransfer(''), toScript: '' },
            buildTransfer('bc1decoy'),
          ]),
          unsignedTx: {} as never,
          isUTXO: true,
        });
      expect(
        components
          .filter(
            (component): component is IDisplayComponentAddress =>
              component.type === EParseTxComponentType.Address,
          )
          .map(({ address, tags }) => ({ address, tags })),
      ).toEqual([
        {
          address: '',
          tags: [{ value: 'No address', displayType: 'warning' }],
        },
        { address: 'bc1decoy', tags: [] },
      ]);
    });

    it('adds no script row for account-model chains', () => {
      expect(recipientRows(false)).toEqual([
        { label: 'To', address: 'bc1decoy', tags: [], highlight: true },
      ]);
    });
  });

  describe('transfer that names no recipient', () => {
    // BTC SIGHASH_SINGLE listing: the input is given up to no one in
    // particular and the committed output comes back.
    const buildListing = (): IDecodedTx => {
      const decodedTx = buildDecodedTx([buildTransfer('')]);
      const transfer = decodedTx.actions[0].assetTransfer;
      if (transfer) {
        transfer.receives = [
          buildTransfer('bc1payout'),
          buildTransfer('bc1payout'),
        ];
      }
      return decodedTx;
    };
    const addressRows = (isUTXO: boolean) =>
      convertDecodedTxActionsToSignatureConfirmTxDisplayComponents({
        decodedTx: buildListing(),
        unsignedTx: {} as never,
        isUTXO,
      })
        .filter(
          (component): component is IDisplayComponentAddress =>
            component.type === EParseTxComponentType.Address,
        )
        .map(({ label, address }) => ({ label, address }));

    it('shows where a UTXO payout lands', () => {
      expect(addressRows(true)).toEqual([
        { label: 'Receiving address', address: 'bc1payout' },
      ]);
    });

    it('adds no receiving row for account-model chains', () => {
      expect(addressRows(false)).toEqual([]);
    });
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

describe('checkDecodedTxHasScalingBalanceMultiplier', () => {
  const base = {
    txid: '',
    owner: '0xowner',
    signer: '0xowner',
    networkId: 'evm--56',
    accountId: 'test-account',
    status: EDecodedTxStatus.Pending,
  };

  it('detects a scaling multiplier on a transfer send', () => {
    expect(
      checkDecodedTxHasScalingBalanceMultiplier({
        ...base,
        actions: [
          {
            type: EDecodedTxActionType.ASSET_TRANSFER,
            assetTransfer: {
              from: '0xowner',
              to: '0xdest',
              label: '',
              sends: [{ amount: '1', balanceMultiplier: '1.0006' }],
              receives: [],
            },
          },
        ],
      } as unknown as IDecodedTx),
    ).toBe(true);
  });

  it('detects a scaling multiplier on an approve action', () => {
    expect(
      checkDecodedTxHasScalingBalanceMultiplier({
        ...base,
        actions: [
          {
            type: EDecodedTxActionType.TOKEN_APPROVE,
            tokenApprove: { amount: '1', balanceMultiplier: '2' },
          },
        ],
      } as unknown as IDecodedTx),
    ).toBe(true);
  });

  it('returns false for multiplier 1, invalid, or absent', () => {
    expect(
      checkDecodedTxHasScalingBalanceMultiplier({
        ...base,
        actions: [
          {
            type: EDecodedTxActionType.ASSET_TRANSFER,
            assetTransfer: {
              from: '0xowner',
              to: '0xdest',
              label: '',
              sends: [{ amount: '1', balanceMultiplier: '1' }],
              receives: [{ amount: '2', balanceMultiplier: '--' }],
            },
          },
          {
            type: EDecodedTxActionType.TOKEN_APPROVE,
            tokenApprove: { amount: '1' },
          },
        ],
      } as unknown as IDecodedTx),
    ).toBe(false);
  });

  it('returns false for a tx with no actions', () => {
    expect(
      checkDecodedTxHasScalingBalanceMultiplier({
        ...base,
        actions: [],
      } as unknown as IDecodedTx),
    ).toBe(false);
  });
});

describe('mergeServerAddressRiskTagsIntoComponents', () => {
  function buildAddressComponent(
    address: string,
    tags: IDisplayComponentAddress['tags'] = [],
  ): IDisplayComponentAddress {
    return {
      type: EParseTxComponentType.Address,
      label: 'To',
      address,
      tags,
    };
  }

  const riskTag = {
    value: 'Scam address',
    displayType: 'critical',
  } as IDisplayComponentAddress['tags'][number];
  const infoTag = {
    value: 'Uniswap',
    displayType: 'success',
  } as IDisplayComponentAddress['tags'][number];

  it('copies server risk tags onto the matching local address (case-insensitive)', () => {
    const merged = mergeServerAddressRiskTagsIntoComponents({
      localComponents: [buildAddressComponent('0xABCDEF')],
      serverComponents: [buildAddressComponent('0xabcdef', [riskTag, infoTag])],
    });
    expect((merged[0] as IDisplayComponentAddress).tags).toEqual([riskTag]);
  });

  it('leaves non-matching and non-address components untouched', () => {
    const tokenComponent = {
      type: EParseTxComponentType.Token,
    } as unknown as IDisplayComponentAddress;
    const merged = mergeServerAddressRiskTagsIntoComponents({
      localComponents: [buildAddressComponent('0x1111'), tokenComponent],
      serverComponents: [buildAddressComponent('0x2222', [riskTag])],
    });
    expect((merged[0] as IDisplayComponentAddress).tags).toEqual([]);
    expect(merged[1]).toBe(tokenComponent);
  });

  it('returns local components unchanged when the server has no risk tags', () => {
    const localComponents = [buildAddressComponent('0x1111')];
    expect(
      mergeServerAddressRiskTagsIntoComponents({
        localComponents,
        serverComponents: [buildAddressComponent('0x1111', [infoTag])],
      }),
    ).toBe(localComponents);
    expect(
      mergeServerAddressRiskTagsIntoComponents({
        localComponents,
        serverComponents: undefined,
      }),
    ).toBe(localComponents);
  });

  it('dedupes repeated server tags for the same address', () => {
    const merged = mergeServerAddressRiskTagsIntoComponents({
      localComponents: [buildAddressComponent('0x1111')],
      serverComponents: [
        buildAddressComponent('0x1111', [riskTag]),
        buildAddressComponent('0x1111', [riskTag]),
      ],
    });
    expect((merged[0] as IDisplayComponentAddress).tags).toEqual([riskTag]);
  });

  it('keeps existing local tags and appends only missing server risk tags', () => {
    const localTag = {
      value: 'My label',
      displayType: 'warning',
    } as IDisplayComponentAddress['tags'][number];
    const merged = mergeServerAddressRiskTagsIntoComponents({
      localComponents: [buildAddressComponent('0x1111', [localTag, riskTag])],
      serverComponents: [buildAddressComponent('0x1111', [riskTag])],
    });
    expect((merged[0] as IDisplayComponentAddress).tags).toEqual([
      localTag,
      riskTag,
    ]);
  });

  it('preserves a risky server address with no local counterpart as a component', () => {
    const serverRow: IDisplayComponentAddress = {
      type: EParseTxComponentType.Address,
      label: 'Token contract',
      address: '0xC0FFEE',
      tags: [riskTag, infoTag],
    };
    const merged = mergeServerAddressRiskTagsIntoComponents({
      localComponents: [buildAddressComponent('0x1111')],
      serverComponents: [serverRow],
    });
    expect(merged).toHaveLength(2);
    expect((merged[0] as IDisplayComponentAddress).tags).toEqual([]);
    expect(merged[1]).toBe(serverRow);
  });

  it('does not append benign-only or locally matched server addresses', () => {
    const merged = mergeServerAddressRiskTagsIntoComponents({
      localComponents: [buildAddressComponent('0x1111')],
      serverComponents: [
        // matched risky row: merged into the local component, never appended
        buildAddressComponent('0X1111', [riskTag]),
        // benign-only row with no local counterpart: dropped
        buildAddressComponent('0x2222', [infoTag]),
      ],
    });
    expect(merged).toHaveLength(1);
    expect((merged[0] as IDisplayComponentAddress).tags).toEqual([riskTag]);
  });
});
