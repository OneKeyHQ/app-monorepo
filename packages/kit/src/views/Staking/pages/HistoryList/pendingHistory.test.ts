import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import {
  buildPendingStakeHistory,
  resolvePendingTokenLogo,
} from './pendingHistory';

const usdt: IToken = {
  address: '0xUSDT',
  symbol: 'USDT',
  name: 'Tether',
  decimals: 6,
  isNative: false,
  networkId: 'evm--1',
  logoURI: 'https://example.com/usdt.png',
};
const receipt: IToken = {
  ...usdt,
  address: '0xReceipt',
  symbol: 'RECEIPT',
  logoURI: 'https://example.com/receipt.png',
  networkId: 'evm--10',
};
const decodedTx = { txid: 'tx-id', networkId: 'evm--1', createdAt: 123 };

function makeInfo(
  actions: Pick<IStakingInfo, 'send' | 'receive'>,
): IStakingInfo {
  return { label: EEarnLabels.Stake, protocol: 'Native', tags: [], ...actions };
}

describe('buildPendingStakeHistory', () => {
  it('uses the sent asset for a first subscription without remote history tokens', () => {
    const item = buildPendingStakeHistory({
      decodedTx,
      stakingInfo: makeInfo({ send: { token: usdt, amount: '0.001' } }),
      title: 'Stake',
      tokens: [],
    });
    expect(item).toEqual(
      expect.objectContaining({
        direction: 'send',
        amount: '0.001',
        tokenAddress: usdt.address,
        networkId: 'evm--1',
        token: { info: usdt },
      }),
    );
  });

  it('uses the received asset for a receive-only transaction', () => {
    const item = buildPendingStakeHistory({
      decodedTx,
      stakingInfo: makeInfo({ receive: { token: receipt, amount: '2' } }),
      title: 'Withdraw',
      tokens: [],
    });
    expect(item).toEqual(
      expect.objectContaining({
        direction: 'receive',
        amount: '2',
        tokenAddress: receipt.address,
        networkId: 'evm--10',
        token: { info: receipt },
      }),
    );
  });

  it('keeps the send asset for display and the existing history network selection', () => {
    const item = buildPendingStakeHistory({
      decodedTx,
      stakingInfo: makeInfo({
        send: { token: usdt, amount: '1' },
        receive: { token: receipt, amount: '2' },
      }),
      title: 'Stake',
      tokens: [{ info: receipt }],
    });
    expect(item).toEqual(
      expect.objectContaining({
        direction: 'send',
        amount: '1',
        tokenAddress: usdt.address,
        networkId: 'evm--10',
        token: { info: usdt },
      }),
    );
  });

  it('only supplements a missing logo from the same token on the same network', () => {
    const local = { ...usdt, logoURI: undefined };
    const wrongNetwork = {
      ...usdt,
      networkId: 'evm--10',
      logoURI: 'https://example.com/wrong.png',
    };
    const build = (tokens: Array<{ info: IToken }>) =>
      buildPendingStakeHistory({
        decodedTx,
        stakingInfo: makeInfo({ send: { token: local, amount: '1' } }),
        title: 'Stake',
        tokens,
      });
    expect(
      build([{ info: wrongNetwork }]).token?.info?.logoURI,
    ).toBeUndefined();
    expect(
      build([{ info: wrongNetwork }, { info: usdt }]).token?.info?.logoURI,
    ).toBe(usdt.logoURI);
  });

  it('handles an empty native address and older entries without token network or action', () => {
    const native = {
      ...usdt,
      address: '',
      symbol: 'ETH',
      isNative: true,
      networkId: undefined,
    };
    const item = buildPendingStakeHistory({
      decodedTx,
      stakingInfo: makeInfo({ send: { token: native, amount: '1' } }),
      title: 'Stake',
      tokens: [],
    });
    expect(item.token?.info).toEqual(native);
    expect(item.networkId).toBe('evm--1');
    const missing = buildPendingStakeHistory({
      decodedTx,
      stakingInfo: makeInfo({}),
      title: 'Stake',
      tokens: [],
    });
    expect(missing.token).toBeUndefined();
    expect(missing.networkId).toBe('evm--1');
  });
});

describe('resolvePendingTokenLogo', () => {
  const network = {
    networkId: 'evm--1',
    name: 'Ethereum',
    logoURI: 'https://example.com/eth.png',
  };

  it('uses the local asset logo before any network icon', () => {
    expect(
      resolvePendingTokenLogo({ token: usdt, network, networks: [network] }),
    ).toBe(usdt.logoURI);
  });

  it('does not show a network logo for an ERC-20 without a logo', () => {
    expect(
      resolvePendingTokenLogo({
        token: { ...usdt, logoURI: undefined },
        network,
        networks: [network],
      }),
    ).toBeUndefined();
  });

  it('uses the network logo only for a native asset on the same network', () => {
    const native = {
      ...usdt,
      address: '',
      symbol: 'ETH',
      isNative: true,
      logoURI: undefined,
    };
    expect(
      resolvePendingTokenLogo({ token: native, network, networks: [network] }),
    ).toBe(network.logoURI);
    expect(
      resolvePendingTokenLogo({
        token: { ...native, networkId: 'evm--10' },
        network,
        networks: [network],
      }),
    ).toBeUndefined();
    expect(
      resolvePendingTokenLogo({
        token: { ...native, networkId: undefined },
        network,
        networks: [network],
      }),
    ).toBeUndefined();
  });
});
