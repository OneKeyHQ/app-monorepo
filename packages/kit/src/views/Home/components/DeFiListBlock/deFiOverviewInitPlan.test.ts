import {
  buildDeFiOverviewInitOwnerKey,
  planDeFiOverviewInit,
} from './deFiOverviewInitPlan';

const owner = {
  accountId: 'hd-1--m/44h/60h/0h/0/0',
  networkId: 'onekeyall--0',
  accountAddress: '0xabc',
};

describe('planDeFiOverviewInit', () => {
  it('resets readiness on the first init for an owner', () => {
    const plan = planDeFiOverviewInit({
      ...owner,
      lastInitOwnerKey: undefined,
    });
    expect(plan.isOwnerChanged).toBe(true);
    expect(plan.shouldResetReadiness).toBe(true);
    expect(plan.shouldHydrateSingleNetworkCache).toBe(false);
  });

  it('keeps all-network readiness when only the currency map changed', () => {
    // A currency-map refresh re-fires the init effect for the SAME owner.
    // The cache-only Portfolio instance only writes readiness during the
    // cold cache probe, so clearing it here would leave the header pinned
    // on the last confirmed balance until the DeFi tab is visited.
    const plan = planDeFiOverviewInit({
      ...owner,
      lastInitOwnerKey: buildDeFiOverviewInitOwnerKey(owner),
    });
    expect(plan.isOwnerChanged).toBe(false);
    expect(plan.shouldResetReadiness).toBe(false);
    expect(plan.shouldHydrateSingleNetworkCache).toBe(false);
  });

  it('re-hydrates the single-network cache for a same-owner re-run', () => {
    const singleNetworkOwner = { ...owner, networkId: 'evm--1' };
    const plan = planDeFiOverviewInit({
      ...singleNetworkOwner,
      lastInitOwnerKey: buildDeFiOverviewInitOwnerKey(singleNetworkOwner),
    });
    expect(plan.shouldResetReadiness).toBe(false);
    expect(plan.shouldHydrateSingleNetworkCache).toBe(true);
  });

  it.each([
    ['accountId', { accountId: 'hd-2--m/44h/60h/0h/0/0' }],
    ['networkId', { networkId: 'evm--1' }],
    ['accountAddress', { accountAddress: '0xdef' }],
  ])('resets readiness when %s changes', (_field, patch) => {
    const plan = planDeFiOverviewInit({
      ...owner,
      ...patch,
      lastInitOwnerKey: buildDeFiOverviewInitOwnerKey(owner),
    });
    expect(plan.isOwnerChanged).toBe(true);
    expect(plan.shouldResetReadiness).toBe(true);
  });
});
