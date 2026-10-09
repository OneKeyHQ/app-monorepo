import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
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
  SUSDE_VAULT,
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
      'evm--1-ethena',
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
      'evm--1': 12,
      'evm--8453': 2,
      'sol--101': 2,
    });
  });
});

describe('earn position model: one card per stage of a position', () => {
  it('keeps the staked principal on one card, with Manage', () => {
    const deposit = card(protocolRow('evm--1-lido'), 'lido:evm--1:steth');
    expect(deposit.stage).toBe('active');
    expect(
      deposit.sections.map((section) => [section.kind, section.title]),
    ).toEqual([['deposited', ETranslations.earn_deposited]]);
    expect(deposit.badgeLabel).toBe(ETranslations.earn_category_staked__title);
    expect(deposit.locked).toBeUndefined();
    expect(deposit.action).toEqual({
      kind: 'manage',
      target: { networkId: 'evm--1', provider: 'lido', symbol: 'ETH' },
    });
    expect(deposit.value.value).toBeCloseTo(4 * 3150, 6);
  });

  it('puts the principal out of its cooldown on a claimable card of its own, with Claim', () => {
    const claimable = card(
      protocolRow('evm--1-lido'),
      'lido:evm--1:steth:claimable',
    );
    expect(claimable.stage).toBe('claimable');
    expect(claimable.locked).toBeUndefined();
    // the same badge and name as the deposit: one position, another stage
    expect(claimable.badgeLabel).toBe(
      ETranslations.earn_category_staked__title,
    );
    expect(claimable.name).toBe('Lido staked ETH');
    expect(
      claimable.sections.map((section) => [section.kind, section.title]),
    ).toEqual([['claimable', ETranslations.earn_claimable]]);
    expect(claimable.action).toEqual({ kind: 'claim' });
    expect(claimable.value.value).toBeCloseTo(0.5 * 3150, 6);
  });

  it('shows each withdrawal in progress as a locked card named after its unlock time', () => {
    const lido = protocolRow('evm--1-lido');
    const locked = lido.positions.filter(
      (position) => position.stage === 'unstaking',
    );
    expect(locked.map((position) => position.key)).toEqual([
      'lido:evm--1:steth:unstaking:1',
      'lido:evm--1:steth:unstaking:0',
    ]);
    const [later, sooner] = locked;
    expect(sooner.badgeLabel).toBe(
      ETranslations.wallet_defi_position_module_locked,
    );
    expect(sooner.name).toBe(
      `${ETranslations.earn_unlock_time}: ${formatDate(new Date(LIDO_UNLOCK_AT), { hideTimeForever: true })}`,
    );
    expect(later.locked).toEqual({ unlockAt: LIDO_LATER_UNLOCK_AT });
    expect(
      sooner.sections.map((section) => [section.kind, section.title]),
    ).toEqual([['unstaking', ETranslations.earn_withdrawal_requested]]);
    expect(
      sooner.sections[0].assets.map((asset) => [asset.amount, asset.unlockAt]),
    ).toEqual([['0.25', LIDO_UNLOCK_AT]]);
    // the way back to the detail page stays on the locked card
    expect(sooner.action?.kind).toBe('manage');
  });

  it('files the USDe cooled down at Ethena under Ethena, claimed on the card through Pendle', () => {
    const ethena = protocolRow('evm--1-ethena');
    expect(ethena.positions.map((position) => position.key)).toEqual([
      'ethena:evm--1:USDe',
      `ethena:evm--1:${SUSDE_VAULT}:cooldown`,
    ]);
    const cooldown = card(ethena, `ethena:evm--1:${SUSDE_VAULT}:cooldown`);
    expect(cooldown.stage).toBe('claimable');
    expect(cooldown.badgeLabel).toBe(ETranslations.earn_category_staked__title);
    expect(cooldown.sections.map((section) => section.kind)).toEqual([
      'claimable',
    ]);
    expect(cooldown.action).toEqual({ kind: 'claim' });
    expect(cooldown.source.earn.manage.provider).toBe('pendle');
    expect(cooldown.value.value).toBeCloseTo(0.045_88 * 0.9993, 9);
  });

  it('labels the Ethena card Unstake, its only move left', () => {
    const ethena = card(protocolRow('evm--1-ethena'), 'ethena:evm--1:USDe');
    expect(ethena.stage).toBe('active');
    expect(ethena.action).toEqual({
      kind: 'unstake',
      target: { networkId: 'evm--1', provider: 'ethena', symbol: 'USDe' },
    });
  });

  it('gives each Pendle market its own card, named after its maturity', () => {
    const pendle = protocolRow('evm--1-pendle');
    expect(pendle.positions.map((position) => position.name)).toEqual([
      'PT-USDG-28MAY2026',
      'PT-USD3-17DEC2026',
    ]);
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

  it('keeps the rewards on the staked card, apart from the principal to collect', () => {
    const everstake = protocolRow('evm--1-everstake');
    expect(
      everstake.positions.map((position) => [
        position.stage,
        position.sections.map((section) => section.kind),
      ]),
    ).toEqual([
      ['active', ['deposited', 'rewards']],
      ['claimable', ['claimable']],
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
    // principal to collect is a DeFi Assets card, never a reward
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
      (position) =>
        position.protocol === 'everstake' && position.rewards.length > 0,
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
