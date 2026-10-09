import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnPortfolioPosition,
  IEarnPortfolioPositionsResponse,
} from '@onekeyhq/shared/types/earn/portfolioPositions';

import {
  buildEarnClaimableRewardsView,
  buildEarnPortfolioView,
  countEarnPositionsByNetwork,
  filterEarnProtocolsByNetworks,
  sumEarnClaimableRewards,
} from './earnPositionModel';
import {
  EARN_PORTFOLIO_POSITIONS_FIXTURE,
  LIDO_LATER_UNLOCK_AT,
  LIDO_UNLOCK_AT,
} from './earnPositionModel.fixtures';

import type { IEarnPositionView, IEarnProtocolView } from './earnPositionModel';

// Returns the key itself, so assertions read against ETranslations.
const translate = (id: ETranslations) => id as string;

const view = buildEarnPortfolioView({
  response: EARN_PORTFOLIO_POSITIONS_FIXTURE,
  translate,
});

function protocolRow(key: string): IEarnProtocolView {
  const row = view.protocols.find((protocol) => protocol.key === key);
  if (!row) {
    throw new OneKeyLocalError(`missing protocol row ${key}`);
  }
  return row;
}

function card(row: IEarnProtocolView, key: string): IEarnPositionView {
  const position = row.positions.find((item) => item.key === key);
  if (!position) {
    throw new OneKeyLocalError(`missing card ${key}`);
  }
  return position;
}

describe('earn position model: protocol rows', () => {
  it('has one row per protocol per network, like the wallet', () => {
    expect(view.protocols.map((protocol) => protocol.key).toSorted()).toEqual([
      'evm--1-everstake',
      'evm--1-lido',
      'evm--1-morpho',
      'evm--1-pendle',
      'evm--8453-morpho',
      'evm--8453-pendle',
      'sol--101-stakefish',
    ]);
  });

  it('sorts rows by value and adds each row up from its cards', () => {
    const values = view.protocols.map((protocol) => protocol.value.value);
    expect(values).toEqual(values.toSorted((a, b) => b - a));
    view.protocols.forEach((protocol) => {
      const cardSum = protocol.positions.reduce(
        (sum, position) => sum + position.value.value,
        0,
      );
      expect(protocol.value.value).toBeCloseTo(cardSum, 9);
    });
    const rowSum = view.protocols.reduce(
      (sum, protocol) => sum + protocol.value.value,
      0,
    );
    expect(view.totalValue).toBeCloseTo(rowSum, 9);
  });

  it('filters by network exactly and counts positions per network', () => {
    const baseRows = filterEarnProtocolsByNetworks(view.protocols, [
      'evm--8453',
    ]);
    expect(baseRows.map((protocol) => protocol.key).toSorted()).toEqual([
      'evm--8453-morpho',
      'evm--8453-pendle',
    ]);
    expect(filterEarnProtocolsByNetworks(view.protocols, [])).toBe(
      view.protocols,
    );
    expect(countEarnPositionsByNetwork(view.protocols)).toEqual({
      'evm--1': 6,
      'evm--8453': 2,
      'sol--101': 1,
    });
  });
});

describe('earn position model: one card per position', () => {
  it('keeps a deposit with its claimable and unstaking principal on one card, in that order', () => {
    const lido = protocolRow('evm--1-lido');
    expect(lido.positions).toHaveLength(1);
    const [position] = lido.positions;
    expect(
      position.sections.map((section) => [section.kind, section.title]),
    ).toEqual([
      ['deposited', ETranslations.earn_deposited],
      ['claimable', ETranslations.earn_claimable],
      ['unstaking', ETranslations.earn_withdrawal_requested],
    ]);
    // the unlock time lines up with the detail rows the server cut the assets from
    expect(
      position.sections[2].assets.map((asset) => [
        asset.amount,
        asset.unlockAt,
      ]),
    ).toEqual([
      ['0.25', LIDO_UNLOCK_AT],
      ['0.3', LIDO_LATER_UNLOCK_AT],
    ]);
    expect(position.badgeLabel).toBe(ETranslations.earn_category_staked__title);
    expect(position.manage).toEqual({
      networkId: 'evm--1',
      provider: 'lido',
      symbol: 'ETH',
    });
    // 4 + 0.5 + 0.25 + 0.3 ETH at 3150: the principal states count in the value
    expect(position.value.value).toBeCloseTo(5.05 * 3150, 6);
  });

  it('gives each Pendle market its own card, named after its maturity', () => {
    const pendle = protocolRow('evm--1-pendle');
    expect(pendle.positions.map((position) => position.name)).toEqual([
      'PT-USDG-28MAY2026',
      'PT-USD3-17DEC2026',
    ]);
    pendle.positions.forEach((position) => {
      expect(position.sections).toHaveLength(1);
      expect(position.sections[0].assets).toHaveLength(1);
    });
  });

  it('shows a loan as Supplied / Borrowed / Rewards with its health factor, debt subtracted', () => {
    const loan = card(
      protocolRow('evm--1-morpho'),
      'morpho:evm--1:market:weth-usdc',
    );
    expect(loan.badgeLabel).toBe(ETranslations.earn_loans);
    expect(loan.sections.map((section) => section.title)).toEqual([
      ETranslations.wallet_defi_asset_type_supplied,
      ETranslations.wallet_defi_asset_type_borrowed,
      ETranslations.wallet_defi_position_module_rewards,
    ]);
    expect(loan.meta).toEqual({ kind: 'healthFactor', healthFactor: 1.62 });
    // 0.02 WETH * 3150 + 1.2 MORPHO * 1.2 - 20.01 USDC
    expect(loan.value.value).toBeCloseTo(44.43, 9);
  });

  it('keeps withdrawn principal out of the rewards section', () => {
    const everstake = card(
      protocolRow('evm--1-everstake'),
      'everstake:evm--1:eth',
    );
    expect(everstake.sections.map((section) => section.kind)).toEqual([
      'deposited',
      'claimable',
      'rewards',
    ]);
  });

  it('never merges positions that come without a groupId', () => {
    const orphan = (name: string): IEarnPortfolioPosition => ({
      ...EARN_PORTFOLIO_POSITIONS_FIXTURE.positions['evm--1'][0],
      groupId: '',
      name,
    });
    const response: IEarnPortfolioPositionsResponse = {
      positions: { 'evm--1': [orphan('A'), orphan('B')] },
      protocolSummaries: [],
      errors: [],
    };
    const [lido] = buildEarnPortfolioView({ response, translate }).protocols;
    expect(lido.positions.map((position) => position.name).toSorted()).toEqual([
      'A',
      'B',
    ]);
  });
});

describe('earn position model: rewards claimable stage', () => {
  const claimable = buildEarnClaimableRewardsView(view.protocols);

  it('lists only positions with priced rewards, valued at the rewards alone', () => {
    const morpho = claimable.find(
      (protocol) => protocol.key === 'evm--1-morpho',
    );
    expect(
      morpho?.positions.map((position) => position.key).toSorted(),
    ).toEqual([
      'morpho:evm--1:0xa71d08a159258553a5ac190d60fa919425ff02ea',
      'morpho:evm--1:market:weth-usdc',
    ]);
    // 1.2 MORPHO + 0.0213 MORPHO, both at $1.2
    expect(morpho?.value.value).toBeCloseTo(1.2 * 1.2 + 0.0213 * 1.2, 9);
    morpho?.positions.forEach((position) => {
      expect(position.sections.map((section) => section.kind)).toEqual([
        'rewards',
      ]);
      expect(position.variant).toBe('rewards');
    });
    expect(claimable.map((protocol) => protocol.key).toSorted()).toEqual([
      'evm--1-everstake',
      'evm--1-morpho',
    ]);
    expect(sumEarnClaimableRewards(view.protocols)).toBeCloseTo(
      1.2 * 1.2 + 0.0213 * 1.2 + 0.001 * 3150,
      9,
    );
  });

  it('leaves a reward the server has not priced on the DeFi Assets card, not in the list', () => {
    const everstake = EARN_PORTFOLIO_POSITIONS_FIXTURE.positions['evm--1'].find(
      (position) => position.protocol === 'everstake',
    );
    if (!everstake) {
      throw new OneKeyLocalError('fixture changed: Everstake missing');
    }
    const unpriced: IEarnPortfolioPosition = {
      ...everstake,
      groupId: 'everstake:evm--1:unpriced',
      rewards: everstake.rewards.map((reward) => ({
        ...reward,
        price: 0,
        value: 0,
      })),
    };
    const response: IEarnPortfolioPositionsResponse = {
      positions: { 'evm--1': [everstake, unpriced] },
      protocolSummaries: [],
      errors: [],
    };
    const { protocols } = buildEarnPortfolioView({ response, translate });
    expect(protocols[0].positions).toHaveLength(2);
    const [row] = buildEarnClaimableRewardsView(protocols);
    expect(row.positions.map((position) => position.key)).toEqual([
      everstake.groupId,
    ]);
  });
});
