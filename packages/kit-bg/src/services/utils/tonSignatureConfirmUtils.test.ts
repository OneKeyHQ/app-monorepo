import { Address, beginCell } from '@ton/core';

import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import { ENFTType } from '@onekeyhq/shared/types/nft';
import {
  EParseTxComponentRole,
  EParseTxComponentType,
  ETransferDirection,
  type IDisplayComponent,
  type IDisplayComponentNFT,
  type IDisplayComponentToken,
} from '@onekeyhq/shared/types/signatureConfirm';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
  type IDecodedTx,
} from '@onekeyhq/shared/types/tx';

import { mergeTonUnknownServerDisplay } from './tonSignatureConfirmUtils';

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    onLocaleChange: () => undefined,
  },
}));

const networkId = 'ton--mainnet';
const from = `0:${'11'.repeat(32)}`;
const owner = `0:${'22'.repeat(32)}`;
const item = `0:${'33'.repeat(32)}`;
const master = `0:${'44'.repeat(32)}`;
const other = `0:${'55'.repeat(32)}`;
const friendly = (address: string) =>
  Address.parse(address).toString({ bounceable: false });

const nft: IDisplayComponentNFT = {
  type: EParseTxComponentType.NFT,
  label: 'NFT',
  nft: {
    amount: '1',
    collectionAddress: item,
    collectionName: 'Collection',
    collectionSymbol: 'NFT',
    collectionType: ENFTType.ERC721,
    itemId: '1',
  },
  networkId,
  amount: '1',
  showNetwork: true,
};

function token(
  address: string,
  amountParsed: string,
  isNative = false,
): IDisplayComponentToken {
  return {
    type: EParseTxComponentType.Token,
    label: 'Asset',
    token: {
      balance: '0',
      balanceParsed: '0',
      fiatValue: '0',
      price: 0,
      info: {
        address,
        decimals: isNative ? 9 : 6,
        symbol: 'SAME',
        name: 'Same name',
        isNative,
      },
    },
    amount: amountParsed,
    amountParsed,
    networkId,
    showNetwork: true,
    transferDirection: ETransferDirection.Out,
  };
}

function setup({
  jetton = false,
  payload,
}: { jetton?: boolean; payload?: string } = {}) {
  const decodedTx: IDecodedTx = {
    txid: '',
    owner: from,
    signer: from,
    nonce: 0,
    status: EDecodedTxStatus.Pending,
    networkId,
    accountId: 'account',
    extraInfo: null,
    actions: [
      { type: EDecodedTxActionType.UNKNOWN, unknownAction: { from, to: item } },
      {
        type: EDecodedTxActionType.ASSET_TRANSFER,
        assetTransfer: {
          from,
          to: item,
          receives: [],
          sends: [
            {
              from,
              to: item,
              amount: '0.05',
              isNative: true,
              tokenIdOnNetwork: '',
              name: 'Toncoin',
              symbol: 'TON',
              icon: '',
            },
            ...(jetton
              ? [
                  {
                    from,
                    to: owner,
                    amount: '1.5',
                    isNative: false,
                    tokenIdOnNetwork: master,
                    name: 'Jetton',
                    symbol: 'SAME',
                    icon: '',
                  },
                ]
              : []),
          ],
        },
      },
    ],
  };
  const localComponents: IDisplayComponent[] = [
    {
      type: EParseTxComponentType.Address,
      label: 'Contract',
      address: friendly(item),
      tags: [],
    },
  ];
  const encodedTx: IEncodedTxTon = {
    from,
    messages: [{ address: item, amount: '50000000', payload }],
  };
  const run = (serverComponents: IDisplayComponent[]) =>
    mergeTonUnknownServerDisplay({
      decodedTx,
      encodedTx,
      localComponents,
      serverComponents,
    });
  return { decodedTx, encodedTx, localComponents, run };
}

function nftPayload(
  kind:
    | 'inline'
    | 'ref'
    | 'truncated'
    | 'nullOwner'
    | 'trailingRef'
    | 'wrongOpcode',
) {
  const body = beginCell()
    .storeUint(kind === 'wrongOpcode' ? 0x12_34_56_78 : 0x5f_cc_3d_14, 32)
    .storeUint(0, 64)
    .storeAddress(kind === 'nullOwner' ? null : Address.parse(owner));
  if (kind !== 'truncated') {
    body
      .storeAddress(Address.parse(from))
      .storeMaybeRef(beginCell().storeUint(1, 8).endCell())
      .storeCoins(1);
    if (kind === 'ref' || kind === 'trailingRef') {
      body.storeBit(true).storeRef(beginCell().storeUint(7, 8).endCell());
      if (kind === 'trailingRef') body.storeRef(beginCell().endCell());
    } else {
      body.storeBit(false).storeUint(7, 8);
    }
  }
  return body.endCell().toBoc().toString('base64');
}

describe('TON partial confirmation display', () => {
  it('does not let native flags or invalid addresses bypass asset identity checks', () => {
    const { run, localComponents } = setup({ jetton: true });
    const disguisedKnown = {
      ...token(master, '999', true),
      transferDirection: ETransferDirection.In,
    };
    const disguisedUnknown = token(other, '999', true);
    const invalidAddress = token('not-a-ton-address', '999');
    expect(
      run([
        disguisedKnown,
        disguisedUnknown,
        invalidAddress,
        {
          type: EParseTxComponentType.Simulation,
          label: 'Simulation',
          assets: [disguisedKnown, disguisedUnknown, invalidAddress],
        },
      ]),
    ).toEqual([
      ...localComponents,
      {
        type: EParseTxComponentType.Simulation,
        label: 'Simulation',
        assets: [],
      },
    ]);
  });

  it('keeps distinct asset identities and NFTs while removing known Jetton/native duplicate facts', () => {
    const { run, decodedTx, localComponents } = setup({ jetton: true });
    const unknownToken = token(other, '7');
    const components = run([
      token(Address.parse(master).toString({ bounceable: true }), '999'),
      token('', '999', true),
      {
        type: EParseTxComponentType.Assets,
        label: 'Effects',
        assets: [nft, unknownToken, token(master, '999')],
      },
      {
        type: EParseTxComponentType.InternalAssets,
        label: 'Unidentified',
        name: 'Same name',
        symbol: 'SAME',
        icon: '',
        amount: '999',
        amountParsed: '999',
      },
      { type: EParseTxComponentType.Default, label: 'Amount', value: '999' },
    ]);
    expect(components).toEqual([
      ...localComponents,
      {
        type: EParseTxComponentType.Assets,
        label: 'Effects',
        assets: [nft, unknownToken],
      },
    ]);
    expect(
      decodedTx.actions[1].assetTransfer?.sends.map((send) => send.amount),
    ).toEqual(['0.05', '1.5']);
  });

  it('keeps net native simulation separate from gross native sends and filters untrusted known Jetton amounts', () => {
    const { run } = setup({ jetton: true });
    const netNative = token('', '0.01', true);
    expect(
      run([
        {
          type: EParseTxComponentType.Simulation,
          label: 'Simulation',
          assets: [nft, token(master, '999'), netNative],
        },
      ]),
    ).toContainEqual({
      type: EParseTxComponentType.Simulation,
      label: 'Simulation',
      assets: [nft, netNative],
    });
  });

  it('does not confuse native receipts or another network with native sends', () => {
    const { run } = setup();
    const incoming = {
      ...token('', '0.01', true),
      transferDirection: ETransferDirection.In,
    };
    const otherNetwork = { ...token('', '2', true), networkId: 'ton--testnet' };
    expect(run([incoming, otherNetwork])).toEqual(
      expect.arrayContaining([incoming, otherNetwork]),
    );
  });

  it.each(['inline', 'ref'] as const)(
    'reads the requested owner from a complete signed NFT request: %s',
    (kind) => {
      const payload = nftPayload(kind);
      const { run, encodedTx, decodedTx } = setup({ payload });
      const forged = friendly(other);
      const server: IDisplayComponent[] = [
        nft,
        {
          type: EParseTxComponentType.Address,
          label: 'Recipient',
          role: EParseTxComponentRole.SwapReceiver,
          address: forged,
          tags: [],
          highlight: true,
        },
      ];
      const components = run(server);
      expect(components).toContainEqual(
        expect.objectContaining({
          address: friendly(owner),
          label: 'global.to',
          highlight: true,
        }),
      );
      expect(components).toContainEqual(
        expect.objectContaining({
          address: forged,
          label: 'global.address',
          role: undefined,
          highlight: false,
        }),
      );
      expect(components).toContainEqual(nft);
      expect(encodedTx.messages[0].payload).toBe(payload);
      expect(decodedTx.actions[0].type).toBe(EDecodedTxActionType.UNKNOWN);
      expect(server[1]).toHaveProperty('label', 'Recipient');
    },
  );

  it.each([
    'truncated',
    'nullOwner',
    'trailingRef',
    'wrongOpcode',
    'invalidBoc',
  ] as const)(
    'does not claim a requested owner from an unsupported NFT request: %s',
    (kind) => {
      const payload = kind === 'invalidBoc' ? 'invalid' : nftPayload(kind);
      const { run } = setup({ payload });
      expect(run([nft])).not.toContainEqual(
        expect.objectContaining({
          address: friendly(owner),
          label: 'global.to',
        }),
      );
    },
  );
});
