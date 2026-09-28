import { buildLocalTxStatusSyncId } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EClaimType } from '@onekeyhq/shared/types/staking';
import type {
  IEarnRewardsPortfolioGroup,
  IEarnRewardsPortfolioItem,
} from '@onekeyhq/shared/types/staking';

import { EARN_PORTFOLIO_POSITIONS_FIXTURE } from './earnPositionModel.fixtures';
import {
  buildClaimSourceCandidates,
  buildNetworkInfoMap,
  hasPositionDetailPage,
  positionPendingTag,
  sumRewardsHeaderFiat,
  toLedgerClaimAsset,
  toPositionClaimAsset,
  toPositionClaimReward,
} from './myPortfolio.utils';

const POSITIONS = Object.values(
  EARN_PORTFOLIO_POSITIONS_FIXTURE.positions,
).flat();
const lidoDeposit = POSITIONS.find(
  (position) => position.groupId === 'lido:evm--1:steth',
);
const lidoClaimable = POSITIONS.find(
  (position) => position.groupId === 'lido:evm--1:withdrawal:81234',
);
if (!lidoDeposit || !lidoClaimable) {
  throw new OneKeyLocalError('fixture changed: Lido positions missing');
}

describe('sumRewardsHeaderFiat', () => {
  it('adds the positions claimable rewards on top of the ledger total', () => {
    expect(
      sumRewardsHeaderFiat({
        ledgerRewardsFiatValue: '12.5',
        positionRewardsValue: 1.44,
      }),
    ).toBe('13.94');
  });

  it('is 0 with nothing loaded', () => {
    expect(
      sumRewardsHeaderFiat({
        ledgerRewardsFiatValue: undefined,
        positionRewardsValue: 0,
      }),
    ).toBe('0');
  });
});

describe('positionPendingTag', () => {
  it('tags a position with the id the detail page stamps on its txs', () => {
    expect(positionPendingTag(lidoDeposit)).toBe(
      buildLocalTxStatusSyncId({
        providerName: 'lido',
        tokenSymbol: 'ETH',
        protocolVault: undefined,
      }),
    );
  });
});

describe('hasPositionDetailPage', () => {
  it('only the Pendle USDe row without buttons has no page', () => {
    expect(hasPositionDetailPage(lidoDeposit)).toBe(true);
    const pendleUsde = {
      ...lidoDeposit,
      protocol: 'pendle',
      earn: {
        ...lidoDeposit.earn,
        symbol: 'USDe',
        investment: { ...lidoDeposit.earn.investment, buttons: [] },
      },
    };
    expect(hasPositionDetailPage(pendleUsde)).toBe(false);
    expect(
      hasPositionDetailPage({
        ...pendleUsde,
        earn: {
          ...pendleUsde.earn,
          investment: {
            ...pendleUsde.earn.investment,
            buttons: [
              { type: 'manage', text: { text: 'Manage' }, disabled: false },
            ],
          },
        },
      }),
    ).toBe(true);
  });
});

describe('toPositionClaimAsset / toPositionClaimReward', () => {
  it('rebuilds the detail asset the claim button keys on: protocol symbol, vault, network', () => {
    const asset = toPositionClaimAsset(lidoClaimable);
    expect(asset.token.info.symbol).toBe(lidoClaimable.earn.symbol);
    expect(asset.metadata.protocol).toMatchObject({
      provider: 'lido',
      symbol: 'ETH',
      providerDetail: { code: 'lido', name: 'Lido' },
    });
    expect(asset.metadata.network.networkId).toBe('evm--1');
    expect(asset.rewardAssets).toEqual([]);
  });

  it('hands the row claim to the button, and nothing for a position without one', () => {
    expect(toPositionClaimReward(lidoClaimable)?.button).toBe(
      lidoClaimable.earn.claim,
    );
    expect(toPositionClaimReward(lidoDeposit)).toBeUndefined();
  });
});

describe('buildClaimSourceCandidates / buildNetworkInfoMap', () => {
  it('lists every held position as a claim source, by protocol symbol', () => {
    const candidates = buildClaimSourceCandidates([lidoDeposit, lidoClaimable]);
    expect(candidates).toEqual([
      {
        networkId: 'evm--1',
        providerName: 'lido',
        symbol: 'ETH',
        vault: undefined,
      },
      {
        networkId: 'evm--1',
        providerName: 'lido',
        symbol: 'ETH',
        vault: undefined,
      },
    ]);
  });

  it('names each network once, as the positions name it', () => {
    const map = buildNetworkInfoMap(POSITIONS);
    expect(map.get('evm--1')?.name).toBe(lidoDeposit.earn.network.name);
    expect(map.size).toBe(
      new Set(POSITIONS.map((position) => position.networkId)).size,
    );
  });
});

describe('toLedgerClaimAsset', () => {
  const group: IEarnRewardsPortfolioGroup = {
    provider: 'native',
    providerName: 'OneKey',
    providerLogoURI: 'p.png',
    networkId: 'evm--1',
    total: { fiatValue: '3' },
    items: [],
  };
  const item = {
    title: { text: '1 USDC' },
    description: { text: '$1' },
    token: { info: { symbol: 'USDC', logoURI: 'u.png', address: '0xusdc' } },
    buttons: [
      { type: EClaimType.ClaimOrder, text: { text: 'Claim' }, disabled: false },
    ],
    stage: 'claimable',
    vault: '0xvault',
  } as unknown as IEarnRewardsPortfolioItem;

  it('wraps a ledger row into the airdrop-asset shape the claim button understands', () => {
    const asset = toLedgerClaimAsset({
      group,
      item,
      networkName: 'Ethereum',
      networkLogoURI: 'e.png',
    });
    expect(asset).toMatchObject({
      token: { info: { symbol: 'USDC', address: '0xusdc' } },
      airdropAssets: [{ claimType: 'airdrop', button: item.buttons?.[0] }],
      metadata: {
        protocol: { vault: '0xvault', providerDetail: { code: 'native' } },
        network: { networkId: 'evm--1', name: 'Ethereum', logoURI: 'e.png' },
      },
    });
  });

  it('yields nothing for a row without a button', () => {
    expect(
      toLedgerClaimAsset({
        group,
        item: { ...item, buttons: [] },
        networkName: '',
        networkLogoURI: '',
      }),
    ).toBeUndefined();
  });
});
