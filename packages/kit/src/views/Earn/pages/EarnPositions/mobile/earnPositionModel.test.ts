import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnPortfolioPosition,
  IEarnPortfolioPositionsResponse,
} from '@onekeyhq/shared/types/earn/portfolioPositions';

import {
  buildEarnClaimableRewardsView,
  buildEarnPortfolioView,
  filterEarnProtocolsByNetworks,
} from './earnPositionModel';
import { EARN_PORTFOLIO_POSITIONS_FIXTURE } from './earnPositionModel.fixtures';

import type { IEarnProtocolView } from './earnPositionModel';

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

describe('earn position model: protocol rows', () => {
  it('has one row per protocol per network, like the wallet', () => {
    expect(view.protocols.map((protocol) => protocol.key).toSorted()).toEqual([
      'evm--1-everstake',
      'evm--1-lido',
      'evm--1-morpho',
      'evm--1-pendle',
      'evm--1-stakefish',
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

  it('filters by network exactly, since a row never spans networks', () => {
    const base = filterEarnProtocolsByNetworks(view.protocols, ['evm--8453']);
    expect(base.map((protocol) => protocol.key).toSorted()).toEqual([
      'evm--8453-morpho',
      'evm--8453-pendle',
    ]);
    expect(filterEarnProtocolsByNetworks(view.protocols, [])).toBe(
      view.protocols,
    );
  });
});

describe('earn position model: one card per position', () => {
  it('keeps every groupId as its own card, even under the same name', () => {
    const lido = protocolRow('evm--1-lido');
    expect(lido.positions).toHaveLength(4);
    expect(new Set(lido.positions.map((position) => position.name))).toEqual(
      new Set(['Lido staked ETH']),
    );
    expect(new Set(lido.positions.map((position) => position.key)).size).toBe(
      4,
    );
  });

  it('gives each Pendle market its own card, maturity and single token', () => {
    const pendle = protocolRow('evm--1-pendle');
    expect(pendle.positions.map((position) => position.name)).toEqual([
      'PT-USDG-28MAY2026',
      'PT-USD3-17DEC2026',
      'PT-USDat-14JAN2027',
    ]);
    pendle.positions.forEach((position) => {
      expect(position.sections).toHaveLength(1);
      expect(position.sections[0].assets).toHaveLength(1);
    });
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

describe('earn position model: card content', () => {
  it('orders a protocol: deposit, then claimable, then unstaking by unlock time', () => {
    const lido = protocolRow('evm--1-lido');
    expect(lido.positions.map((position) => position.key)).toEqual([
      'lido:evm--1:steth',
      'lido:evm--1:withdrawal:81234',
      'lido:evm--1:withdrawal:81240',
      'lido:evm--1:withdrawal:81251',
    ]);
  });

  it('labels the principal section by state and gives each state its action', () => {
    const [deposited, claimable, unstaking] =
      protocolRow('evm--1-lido').positions;

    expect(deposited.sections.map((section) => section.title)).toEqual([
      ETranslations.earn_deposited,
    ]);
    expect(deposited.action?.kind).toBe('manage');

    expect(claimable.sections.map((section) => section.title)).toEqual([
      ETranslations.earn_claimable,
    ]);
    expect(claimable.action?.kind).toBe('claim');

    expect(unstaking.sections.map((section) => section.title)).toEqual([
      ETranslations.earn_withdrawal_requested,
    ]);
    expect(unstaking.action).toBeUndefined();
    expect(unstaking.meta).toEqual({
      kind: 'unlockAt',
      unlockAt: Date.parse('2026-10-02T08:00:00Z'),
    });

    expect(
      [deposited, claimable, unstaking].map((position) => position.badgeLabel),
    ).toEqual([
      ETranslations.earn_category_staked__title,
      ETranslations.earn_category_staked__title,
      ETranslations.earn_category_staked__title,
    ]);
  });

  it('shows a loan as Supplied / Borrowed / Rewards with its health factor, debt subtracted', () => {
    const loan = protocolRow('evm--1-morpho').positions.find(
      (position) => position.key === 'morpho:evm--1:market:weth-usdc',
    );
    expect(loan?.badgeLabel).toBe(ETranslations.earn_loans);
    expect(loan?.sections.map((section) => section.title)).toEqual([
      ETranslations.wallet_defi_asset_type_supplied,
      ETranslations.wallet_defi_asset_type_borrowed,
      ETranslations.wallet_defi_position_module_rewards,
    ]);
    expect(loan?.meta).toEqual({ kind: 'healthFactor', healthFactor: 1.62 });
    // 0.02 WETH * 3150 + 1.2 MORPHO * 1.2 - 20.01 USDC
    expect(loan?.value.value).toBeCloseTo(44.43, 9);
  });

  it('keeps withdrawn principal out of the rewards section', () => {
    const everstake = protocolRow('evm--1-everstake');
    const claimable = everstake.positions.find(
      (position) => position.state === 'claimable',
    );
    expect(claimable?.sections.map((section) => section.kind)).toEqual([
      'claimable',
    ]);
    const deposited = everstake.positions.find(
      (position) => position.state === 'active',
    );
    expect(deposited?.sections.map((section) => section.kind)).toEqual([
      'deposited',
      'rewards',
    ]);
  });
});

describe('earn position model: rewards claimable stage', () => {
  const claimable = buildEarnClaimableRewardsView(view.protocols);

  it('lists only positions with rewards, valued at the rewards alone', () => {
    const morpho = claimable.find(
      (protocol) => protocol.key === 'evm--1-morpho',
    );
    expect(morpho?.positions.map((position) => position.key)).toEqual([
      'morpho:evm--1:market:weth-usdc',
      'morpho:evm--1:0xa71d08a159258553a5ac190d60fa919425ff02ea',
    ]);
    // 1.2 MORPHO + 0.0213 MORPHO, both at $1.2
    expect(morpho?.value.value).toBeCloseTo(1.2 * 1.2 + 0.0213 * 1.2, 9);
    morpho?.positions.forEach((position) => {
      expect(position.sections.map((section) => section.kind)).toEqual([
        'rewards',
      ]);
    });
  });

  it('never lists principal: protocols without rewards drop out', () => {
    expect(claimable.map((protocol) => protocol.key).toSorted()).toEqual([
      'evm--1-everstake',
      'evm--1-morpho',
    ]);
  });
});
