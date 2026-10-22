/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import type { IZcashHistoryItem } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import {
  collectPrivacyChainOwnAddresses,
  getPrivacyChainEndpointFlow,
  getPrivacyChainPublicDisplayFlow,
} from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';
import {
  buildLocalWalletHistoryAddressGate,
  gateLocalWalletHistoryTx,
} from '@onekeyhq/shared/src/utils/privacyChainHistoryAddressGate';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import { buildZcashLocalHistoryTx } from './localHistory';
import settings from './settings';

// This account paid a sibling account's transparent address from Ironwood.
const OWN_T_ADDRESS = `t1${'a'.repeat(33)}`;
const OWN_RECEIVE_UA = `u1${'q'.repeat(104)}`;
const SIBLING_T_ADDRESS = `t1${'b'.repeat(33)}`;
const SHIELDED_RECIPIENT = `u1${'p'.repeat(104)}`;

const localWallet = settings.localWallet!;

async function sentRow(recipient: string) {
  const item: IZcashHistoryItem = {
    txid: '3e08b8ac22b8b11f3c1338bf3992a834a89337bb15042de0732449228555582a',
    minedHeight: 3_525_531,
    timestamp: 1,
    valueZat: '-35000',
    fee: '15000',
    pending: false,
    expired: false,
    txType: 'sent',
    recipient,
    poolIds: [4],
    perPoolBalanceDeltaZat: { '4': '-35000' },
  };
  const tx = await buildZcashLocalHistoryTx({
    item,
    chainTip: 3_525_600,
    ownAddress: OWN_T_ADDRESS,
    nativeToken: { address: '', logoURI: '', name: 'Zcash', symbol: 'ZEC' },
    networkId: 'zec--0',
    accountId: 'account-1',
    accountAddress: OWN_T_ADDRESS,
    buildTransferAction: async ({ from, to, transfers }) => ({
      type: EDecodedTxActionType.ASSET_TRANSFER,
      assetTransfer: { from, to, sends: transfers, receives: [] },
    }),
  });
  return gateLocalWalletHistoryTx(
    buildLocalWalletHistoryAddressGate({
      localWallet,
      addresses: {
        publicAddress: OWN_T_ADDRESS,
        privateAddress: OWN_RECEIVE_UA,
      },
      ownerAddress: OWN_T_ADDRESS,
    }),
    tx,
  );
}

// The two flows HistoryDetails renders: public addresses get AddressInfo
// (account name / address book), private ones the local-recipient copy.
function detailFlows(transfer: Awaited<ReturnType<typeof sentRow>>) {
  const assetTransfer = transfer.decodedTx.actions[0]?.assetTransfer;
  return {
    public: getPrivacyChainPublicDisplayFlow({
      publicAddressPattern: localWallet.publicAddressPattern,
      transfer: assetTransfer,
    }),
    private: getPrivacyChainEndpointFlow({
      pools: localWallet.pools,
      publicAddressPattern: localWallet.publicAddressPattern,
      privateAddressPattern: localWallet.privateAddressPattern,
      transfer: assetTransfer,
      isSent: true,
      ownAddresses: collectPrivacyChainOwnAddresses({
        owner: transfer.decodedTx.owner,
        transfer: assetTransfer,
      }),
    }),
  };
}

describe('zcash local history recipient display', () => {
  it('shows a transparent recipient as a public address, not a locally saved one', async () => {
    const row = await sentRow(SIBLING_T_ADDRESS);
    expect(row.decodedTx.actions[0]?.assetTransfer?.to).toBe(SIBLING_T_ADDRESS);

    const flows = detailFlows(row);
    expect(flows.public.to).toEqual([SIBLING_T_ADDRESS]);
    // Nothing on the private side, so no "Saved by this wallet" entry.
    expect(flows.private.to).toEqual([]);
  });

  it('keeps a shielded recipient on the private side', async () => {
    const flows = detailFlows(await sentRow(SHIELDED_RECIPIENT));
    expect(flows.public.to).toEqual([]);
    expect(flows.private.to).toEqual([
      { kind: 'address', address: SHIELDED_RECIPIENT },
    ]);
  });
});
