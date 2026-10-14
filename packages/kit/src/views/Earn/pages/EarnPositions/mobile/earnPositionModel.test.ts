import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnPortfolioPosition,
  IEarnPortfolioPositionsResponse,
} from '@onekeyhq/shared/types/earn/portfolioPositions';

import {
  buildEarnClaimableRewardGroups,
  buildEarnPendingRewardGroups,
  buildEarnPortfolioView,
  countEarnPositionsByNetwork,
  filterEarnProtocolsByNetworks,
  holdingKeyOf,
  sumEarnClaimableRewards,
  sumEarnDefiAssets,
  sumEarnPendingRewards,
} from './earnPositionModel';
import {
  ACCRUING_TOOLTIP,
  EARN_PORTFOLIO_POSITIONS_FIXTURE,
  LIDO_LATER_UNLOCK_AT,
  LIDO_UNLOCK_AT,
  LISTA_VAULT,
  NATIVE_UNLOCK_AT,
  NATIVE_USDT_VAULT,
  SETTLED_ON_REDEEM_TOOLTIP,
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

function fixturePosition(groupId: string): IEarnPortfolioPosition {
  const position = Object.values(EARN_PORTFOLIO_POSITIONS_FIXTURE.positions)
    .flat()
    .find((item) => item.groupId === groupId);
  if (!position) {
    throw new OneKeyLocalError(`fixture changed: ${groupId} missing`);
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
      'evm--1-native',
      'evm--1-pendle',
      'evm--56-lista',
      'evm--8453-morpho',
      'evm--8453-pendle',
      'sol--101-stakefish',
    ]);
  });

  it('sorts rows by value and adds each row up from its cards, rewards included', () => {
    const values = view.protocols.map((protocol) => protocol.value.value);
    expect(values).toEqual(values.toSorted((a, b) => b - a));
    view.protocols.forEach((protocol) => {
      const cardSum = protocol.positions.reduce(
        (sum, position) => sum + position.value.value,
        0,
      );
      expect(protocol.value.value).toBeCloseTo(cardSum, 9);
    });
    // Everstake: 0.1 ETH staked + 0.05 ETH to collect + 0.001 ETH of yield
    expect(protocolRow('evm--1-everstake').value.value).toBeCloseTo(
      0.1 * 3150 + 0.05 * 3150 + 0.001 * 3150,
      9,
    );
  });

  it('leaves the rewards out of the header DeFi Assets figure, debts subtracted', () => {
    const rowSum = view.protocols.reduce(
      (sum, protocol) => sum + protocol.value.value,
      0,
    );
    const rewardSum = view.protocols
      .flatMap((protocol) => protocol.positions)
      .flatMap((position) => position.sections)
      .filter((section) => section.kind === 'rewards')
      .flatMap((section) => section.assets)
      .reduce((sum, asset) => sum + asset.value, 0);
    expect(rewardSum).toBeGreaterThan(0);
    expect(view.totalValue).toBeCloseTo(rowSum - rewardSum, 9);
    expect(sumEarnDefiAssets(view.protocols)).toBe(view.totalValue);
    // the loan: supplied minus borrowed, its MORPHO and KAT left out
    expect(
      sumEarnDefiAssets([
        {
          ...protocolRow('evm--1-morpho'),
          positions: [
            card(
              protocolRow('evm--1-morpho'),
              'morpho:evm--1:market:weth-usdc',
            ),
          ],
        },
      ]),
    ).toBeCloseTo(0.02 * 3150 - 20.01, 9);
  });

  it('filters by network exactly and counts cards per network', () => {
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
    // one card per holding: Lido's four server positions are one card
    expect(countEarnPositionsByNetwork(view.protocols)).toEqual({
      'evm--1': 9,
      'evm--56': 1,
      'evm--8453': 2,
      'sol--101': 1,
    });
  });
});

describe('earn position model: one card per holding', () => {
  it('keys a holding on where it is filed and what it manages, so its states share a card', () => {
    const staked = fixturePosition('lido:evm--1:steth');
    const claimable = fixturePosition('lido:evm--1:steth:claimable');
    const locked = fixturePosition('lido:evm--1:steth:unstaking:0');
    expect(holdingKeyOf(staked)).toBe('lido|evm--1|lido|ETH|');
    expect(holdingKeyOf(claimable)).toBe(holdingKeyOf(staked));
    expect(holdingKeyOf(locked)).toBe(holdingKeyOf(staked));
    // Bitway's U and USDT share a contract and stay apart by symbol; the
    // USDe cooling down at Ethena is filed under Ethena, managed through Pendle
    const cooldown = fixturePosition(`ethena:evm--1:${SUSDE_VAULT}:cooldown`);
    expect(holdingKeyOf(cooldown)).toBe(
      `ethena|evm--1|pendle|USDe|${SUSDE_VAULT}`,
    );
  });

  it('folds the staked principal, each withdrawal in progress and the principal to redeem into one Lido card', () => {
    const lido = protocolRow('evm--1-lido');
    expect(lido.positions.map((position) => position.key)).toEqual([
      'lido:evm--1:steth',
    ]);
    const [deposit] = lido.positions;
    expect(deposit.badgeLabel).toBe(
      ETranslations.wallet_defi_position_module_deposit,
    );
    expect(deposit.name).toBe('Lido staked ETH');
    expect(
      deposit.sections.map((section) => [
        section.kind,
        section.title,
        section.assets.map((asset) => asset.amount),
      ]),
    ).toEqual([
      ['deposited', ETranslations.earn_deposited, ['4']],
      // soonest unlock first
      [
        'pendingWithdrawal',
        ETranslations.earn_withdrawal_requested,
        ['0.25', '0.3'],
      ],
      ['claimable', ETranslations.earn_claimable, ['0.5']],
    ]);
    const pending = deposit.sections.find(
      (section) => section.kind === 'pendingWithdrawal',
    );
    expect(pending?.assets.map((asset) => asset.unlockAt)).toEqual([
      LIDO_UNLOCK_AT,
      LIDO_LATER_UNLOCK_AT,
    ]);
    expect(deposit.value.value).toBeCloseTo((4 + 0.5 + 0.25 + 0.3) * 3150, 6);
    // the way into the detail page, where the principal is redeemed
    expect(deposit.action).toEqual({
      kind: 'manage',
      target: { networkId: 'evm--1', provider: 'lido', symbol: 'ETH' },
    });
    expect(deposit.principalClaims.map((source) => source.groupId)).toEqual([
      'lido:evm--1:steth:claimable',
    ]);
    expect(deposit.claimableRewards).toEqual([]);
    expect(deposit.sources).toHaveLength(4);
    expect(deposit.source.groupId).toBe('lido:evm--1:steth');
    expect([
      deposit.hasDeposit,
      deposit.hasRewards,
      deposit.hasPendingWithdrawal,
      deposit.hasClaimable,
    ]).toEqual([true, false, true, true]);
  });

  it('dates the pending withdrawal row and keeps the category badge on a staked holding', () => {
    const native = card(
      protocolRow('evm--1-native'),
      `native:evm--1:${NATIVE_USDT_VAULT}`,
    );
    expect(native.sections.map((section) => section.kind)).toEqual([
      'deposited',
      'rewards',
      'pendingWithdrawal',
    ]);
    const [row] =
      native.sections.find((section) => section.kind === 'pendingWithdrawal')
        ?.assets ?? [];
    expect(row.unlockAt).toBe(NATIVE_UNLOCK_AT);
    // the row carries no Cancel: the detail page runs it
    expect(row).not.toHaveProperty('cancelSource');
    // still a staked holding: the category badge, not Locked
    expect(native.badgeLabel).toBe(
      ETranslations.wallet_defi_position_module_deposit,
    );
  });

  it('reads Locked when a holding is nothing but withdrawals in progress', () => {
    const locked = fixturePosition('lido:evm--1:steth:unstaking:0');
    const response: IEarnPortfolioPositionsResponse = {
      positions: { 'evm--1': [locked] },
      protocolSummaries: [],
      errors: [],
    };
    const [lido] = buildEarnPortfolioView({ response, translate }).protocols;
    expect(lido.positions).toHaveLength(1);
    expect(lido.positions[0].badgeLabel).toBe(
      ETranslations.wallet_defi_position_module_locked,
    );
    expect(lido.positions[0].hasDeposit).toBe(false);
    expect(lido.positions[0].principalClaims).toEqual([]);
  });

  it('files the USDe cooled down at Ethena under Ethena, redeemable through Pendle', () => {
    const ethena = protocolRow('evm--1-ethena');
    expect(ethena.positions.map((position) => position.key)).toEqual([
      'ethena:evm--1:USDe',
      `ethena:evm--1:${SUSDE_VAULT}:cooldown`,
    ]);
    const cooldown = card(ethena, `ethena:evm--1:${SUSDE_VAULT}:cooldown`);
    // nothing left in the vault but the principal to redeem: still Deposit
    expect(cooldown.badgeLabel).toBe(
      ETranslations.wallet_defi_position_module_deposit,
    );
    expect(cooldown.sections.map((section) => section.kind)).toEqual([
      'claimable',
    ]);
    expect(cooldown.hasDeposit).toBe(false);
    expect(cooldown.principalClaims.map((source) => source.groupId)).toEqual([
      `ethena:evm--1:${SUSDE_VAULT}:cooldown`,
    ]);
    expect(cooldown.source.earn.manage.provider).toBe('pendle');
    expect(cooldown.value.value).toBeCloseTo(0.045_88 * 0.9993, 9);
  });

  it('keeps Manage on the Ethena card, as the detail page has it, badged Deposit like every holding', () => {
    const ethena = card(protocolRow('evm--1-ethena'), 'ethena:evm--1:USDe');
    expect(ethena.badgeLabel).toBe(
      ETranslations.wallet_defi_position_module_deposit,
    );
    expect(ethena.action).toEqual({
      kind: 'manage',
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
    expect(loan.badgeLabel).toBe(
      ETranslations.wallet_defi_position_module_lending,
    );
    expect(loan.sections.map((section) => section.title)).toEqual([
      ETranslations.wallet_defi_asset_type_supplied,
      ETranslations.wallet_defi_asset_type_borrowed,
      ETranslations.wallet_defi_position_module_rewards,
    ]);
    expect(loan.meta).toEqual({ kind: 'healthFactor', healthFactor: 1.62 });
    // 0.02 WETH * 3150 + 1.2 MORPHO * 1.2 + 3 KAT * 0.05 - 20.01 USDC
    expect(loan.value.value).toBeCloseTo(44.58, 9);
  });

  it('keeps the rewards and the principal to redeem on the one Everstake card', () => {
    const everstake = protocolRow('evm--1-everstake');
    expect(everstake.positions.map((position) => position.key)).toEqual([
      'everstake:evm--1:eth',
    ]);
    const [eth] = everstake.positions;
    expect(eth.sections.map((section) => section.kind)).toEqual([
      'deposited',
      'rewards',
      'claimable',
    ]);
    expect(eth.action?.kind).toBe('manage');
    expect(eth.principalClaims.map((source) => source.groupId)).toEqual([
      'everstake:evm--1:eth:claimable',
    ]);
    expect(
      eth.claimableRewards.map((reward) => [
        reward.symbol,
        reward.claim.claimSource,
      ]),
    ).toEqual([['ETH', 'investment']]);
  });

  it('hands the card the rewards whose claim the server sent enabled', () => {
    // two campaign tokens on one market: the sheet
    const loan = card(
      protocolRow('evm--1-morpho'),
      'morpho:evm--1:market:weth-usdc',
    );
    expect(loan.claimableRewards.map((reward) => reward.symbol)).toEqual([
      'MORPHO',
      'KAT',
    ]);
    // a claim the server sent disabled (under the floor) is no Claim on the card
    const stakefish = card(
      protocolRow('sol--101-stakefish'),
      'stakefish:sol--101:SOL',
    );
    expect(stakefish.source.rewards[0].claim?.button).toMatchObject({
      disabled: true,
    });
    expect(stakefish.claimableRewards).toEqual([]);
    expect(stakefish.principalClaims).toHaveLength(1);
    // no rewards, no claim
    expect(
      card(protocolRow('evm--1-pendle'), 'pendle:evm--1:0xusdg')
        .claimableRewards,
    ).toEqual([]);
  });

  it('shows a reward the user cannot claim yet on the card, marked pending with its explanation, and never on its Claim', () => {
    const native = card(
      protocolRow('evm--1-native'),
      `native:evm--1:${NATIVE_USDT_VAULT}`,
    );
    const rewards = native.sections.find(
      (section) => section.kind === 'rewards',
    );
    expect(
      rewards?.assets.map((asset) => [
        asset.symbol,
        asset.amount,
        asset.status,
        asset.tooltip?.type,
      ]),
    ).toEqual([['USDT', '0.0026', 'pending', 'text']]);
    expect(native.hasRewards).toBe(true);
    expect(native.claimableRewards).toEqual([]);
    // the card's value counts it, the way it counts every reward, with the
    // withdrawal in progress the holding folds in
    expect(native.value.value).toBeCloseTo((2 + 0.0026 + 0.112) * 0.9992, 9);
    const base = card(
      protocolRow('evm--8453-morpho'),
      'morpho:evm--8453:0xbase',
    );
    expect(base.sections.map((section) => section.kind)).toEqual([
      'deposited',
      'rewards',
    ]);
    expect(base.claimableRewards).toEqual([]);
  });

  it('hands the card the effective deposit the server sends, and nothing without one', () => {
    const usd3 = fixturePosition('pendle:evm--1:0xusd3');
    const effectiveDeposit = {
      amount: '20.2148',
      symbol: 'USDC',
      fiatValue: '20.21',
      label: { text: 'Effective deposits' },
      tooltip: {
        type: 'text' as const,
        data: {
          title: { text: 'Effective deposits' },
          description: { text: 'Only these earn the platform bonus.' },
        },
      },
    };
    const response: IEarnPortfolioPositionsResponse = {
      positions: {
        'evm--1': [{ ...usd3, earn: { ...usd3.earn, effectiveDeposit } }],
      },
      protocolSummaries: [],
      errors: [],
    };
    const [protocol] = buildEarnPortfolioView({
      response,
      translate,
    }).protocols;
    expect(protocol.positions[0].effectiveDeposit).toEqual(effectiveDeposit);
    expect(
      card(protocolRow('evm--1-pendle'), 'pendle:evm--1:0xusd3')
        .effectiveDeposit,
    ).toBeUndefined();
  });

  it('carries the server PnL on the card it belongs to', () => {
    const usd3 = card(protocolRow('evm--1-pendle'), 'pendle:evm--1:0xusd3');
    expect(usd3.source.earn.pnl).toEqual({
      amount: '0.0205',
      symbol: 'USD3',
      fiatValue: '0.02',
      percent: '1.84',
    });
    expect(
      card(protocolRow('evm--1-pendle'), 'pendle:evm--1:0xusdg').source.earn
        .pnl,
    ).toBeUndefined();
  });
});

describe('earn position model: rewards claimable stage', () => {
  const claimable = buildEarnClaimableRewardGroups(view.protocols);

  it('lists one row per priced reward under its protocol, valued at the rewards alone', () => {
    const morpho = claimable.find((group) => group.key === 'evm--1-morpho');
    expect(
      morpho?.rows.map((row) => [row.position.key, row.asset.symbol]),
    ).toEqual([
      ['morpho:evm--1:0xa71d08a159258553a5ac190d60fa919425ff02ea', 'MORPHO'],
      ['morpho:evm--1:market:weth-usdc', 'MORPHO'],
      ['morpho:evm--1:market:weth-usdc', 'KAT'],
    ]);
    // 0.0213 MORPHO + 1.2 MORPHO at $1.2, 3 KAT at $0.05
    expect(morpho?.value.value).toBeCloseTo(
      1.2 * 1.2 + 0.0213 * 1.2 + 3 * 0.05,
      9,
    );
    // each row keeps the claim the server attached, so it claims in place
    expect(morpho?.rows.map((row) => row.asset.claim?.claimSource)).toEqual([
      'airdrop',
      'airdrop',
      'airdrop',
    ]);
    // principal to collect is a DeFi Assets card, never a reward; a reward
    // under its claim floor still lists, with the claim disabled
    expect(claimable.map((group) => group.key).toSorted()).toEqual([
      'evm--1-everstake',
      'evm--1-morpho',
      'evm--56-lista',
      'sol--101-stakefish',
    ]);
    expect(sumEarnClaimableRewards(view.protocols)).toBeCloseTo(
      1.2 * 1.2 + 0.0213 * 1.2 + 3 * 0.05 + 0.001 * 3150 + 0.0001 * 110,
      9,
    );
  });

  it('lists the rewards the server marked pending on the Pending stage, with their explanation, and keeps them off Claimable', () => {
    const pending = buildEarnPendingRewardGroups(view.protocols);
    expect(
      pending.map((group) => [
        group.key,
        group.rows.map((row) => [
          row.position.key,
          row.asset.symbol,
          row.asset.amount,
          row.asset.tooltip,
        ]),
      ]),
    ).toEqual([
      [
        'evm--1-native',
        [
          [
            `native:evm--1:${NATIVE_USDT_VAULT}`,
            'USDT',
            '0.0026',
            SETTLED_ON_REDEEM_TOOLTIP,
          ],
        ],
      ],
      [
        'evm--8453-morpho',
        [['morpho:evm--8453:0xbase', 'KAT', '0.05938', ACCRUING_TOOLTIP]],
      ],
    ]);
    // nothing to press on a pending row
    expect(
      pending.flatMap((group) => group.rows).every((row) => !row.asset.claim),
    ).toBe(true);
    expect(sumEarnPendingRewards(view.protocols)).toBeCloseTo(
      0.0026 * 0.9992 + 0.059_38 * 0.0046,
      9,
    );
    // Claimable never lists them: the header adds up to the two lists
    expect(claimable.map((group) => group.key)).not.toContain('evm--1-native');
    expect(claimable.map((group) => group.key)).not.toContain(
      'evm--8453-morpho',
    );
  });

  it("offers Lista's Check on the card's row and on the list, its button the only way to the amount", () => {
    const key = `lista:evm--56:USDT:${LISTA_VAULT}`;
    const lista = card(protocolRow('evm--56-lista'), key);
    // the card's rows act like the detail page's: the zero row carries the Check
    expect(lista.sections.map((section) => section.kind)).toEqual([
      'deposited',
      'rewards',
    ]);
    const rewards = lista.sections.find(
      (section) => section.kind === 'rewards',
    );
    expect(
      rewards?.assets.map((asset) => [asset.amount, asset.claim?.button.type]),
    ).toEqual([['0', 'listaCheck']]);
    // it is never one of the rewards a claim collects
    expect(lista.claimableRewards).toEqual([]);
    expect(lista.action?.kind).toBe('manage');
    // the list offers the Check on the row, at zero, adding nothing to the header
    const group = claimable.find((item) => item.key === 'evm--56-lista');
    expect(
      group?.rows.map((row) => [
        row.position.key,
        row.asset.amount,
        row.asset.claim?.button.type,
      ]),
    ).toEqual([[key, '0', 'listaCheck']]);
    expect(group?.value.value).toBe(0);
  });

  it('leaves a reward without an amount yet off the list', () => {
    const morpho = fixturePosition('morpho:evm--1:market:weth-usdc');
    // another holding of the same market shape, its rewards not amounted yet
    const zeroAmount: IEarnPortfolioPosition = {
      ...morpho,
      groupId: 'morpho:evm--1:zeroAmount',
      earn: {
        ...morpho.earn,
        vault: 'market:zero',
        manage: { ...morpho.earn.manage, vault: 'market:zero' },
      },
      rewards: morpho.rewards.map((reward) => ({
        ...reward,
        amount: '0',
        value: 0,
      })),
    };
    const response: IEarnPortfolioPositionsResponse = {
      positions: { 'evm--1': [morpho, zeroAmount] },
      protocolSummaries: [],
      errors: [],
    };
    const { protocols } = buildEarnPortfolioView({ response, translate });
    expect(protocols[0].positions).toHaveLength(2);
    const [group] = buildEarnClaimableRewardGroups(protocols);
    expect(group.rows.map((row) => row.position.key)).toEqual([
      morpho.groupId,
      morpho.groupId,
    ]);
  });

  it('leaves a reward the server has not priced on the DeFi Assets card, not in the list', () => {
    const everstake = fixturePosition('everstake:evm--1:eth');
    const unpriced: IEarnPortfolioPosition = {
      ...everstake,
      groupId: 'everstake:evm--1:unpriced',
      earn: {
        ...everstake.earn,
        vault: '0xunpriced',
        manage: { ...everstake.earn.manage, vault: '0xunpriced' },
      },
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
    const [group] = buildEarnClaimableRewardGroups(protocols);
    expect(group.rows.map((row) => row.position.key)).toEqual([
      everstake.groupId,
    ]);
  });

  it("shows the ledger's rewards on the card and its Claim, and leaves them to the ledger lists and header", () => {
    const native = fixturePosition(`native:evm--1:${NATIVE_USDT_VAULT}`);
    const ledgerClaim = {
      button: {
        type: 'claimAirdrop',
        disabled: false,
        text: { text: 'Claim' },
        data: { balance: '4' },
      },
      claimSource: 'airdrop' as const,
      row: { title: { text: '4 USDT' }, claimType: 'airdrop' as const },
    };
    const withLedger: IEarnPortfolioPosition = {
      ...native,
      rewards: [
        ...native.rewards,
        {
          ...native.rewards[0],
          amount: '4',
          value: 4,
          price: 1,
          status: undefined,
          tooltip: undefined,
          source: 'ledger',
          claim: ledgerClaim,
        } as IEarnPortfolioPosition['rewards'][number],
        {
          ...native.rewards[0],
          amount: '2',
          value: 2,
          price: 1,
          source: 'ledger',
          status: 'pending',
          tooltip: undefined,
        },
      ],
    };
    const response: IEarnPortfolioPositionsResponse = {
      positions: { 'evm--1': [withLedger] },
      protocolSummaries: [],
      errors: [],
    };
    const { protocols } = buildEarnPortfolioView({ response, translate });
    const [holding] = protocols[0].positions;
    const rewards = holding.sections.find(
      (section) => section.kind === 'rewards',
    );
    expect(rewards?.assets.map((asset) => asset.amount)).toEqual([
      '0.0026',
      '4',
      '2',
    ]);
    expect(holding.claimableRewards.map((reward) => reward.amount)).toEqual([
      '4',
    ]);
    // the ledger endpoint lists these rows and adds them to the header
    expect(buildEarnClaimableRewardGroups(protocols)).toEqual([]);
    expect(
      buildEarnPendingRewardGroups(protocols).flatMap((group) =>
        group.rows.map((row) => row.asset.amount),
      ),
    ).toEqual(['0.0026']);
    expect(sumEarnClaimableRewards(protocols)).toBe(0);
  });
});
