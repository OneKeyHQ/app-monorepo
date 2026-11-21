import { getEarnProtocol } from '.';

import type { IStakingFlowConfig } from '@onekeyhq/shared/types/earn';

import { getUniversalWithdrawProtocolPlan } from '../../Staking/earnWithdrawTask/types';

const baseConfig: IStakingFlowConfig = {
  enabled: true,
  tokenAddress: '',
  displayProfit: true,
};

describe('Earn withdrawal protocol selection', () => {
  it.each([
    ['Lido', { unstakeWithSignMessage: true }, false, 'lido'],
    ['unknown', { unstakeWithSignMessage: true }, false, 'lido'],
    ['Stakefish', { unstakeWithSignMessage: true }, true, 'lido'],
    ['unknown', { withdrawSignOnly: true }, false, 'signOnly'],
    ['unknown', { withdrawSignOnly: true }, true, 'ethena'],
    ['Pendle', { unstakeWithSignMessage: true }, true, 'lido'],
    ['Babylon', { withdrawSignOnly: true }, false, 'babylon'],
    ['Babylon', { withdrawSignOnly: true }, true, 'ethena'],
    [
      'Babylon',
      { unstakeWithSignMessage: true, withdrawSignOnly: true },
      false,
      'signOnly',
    ],
    ['Stakefish', {}, false, 'stakefish'],
    ['STAKEFISH', {}, false, 'stakefish'],
    ['Stakefish', {}, true, 'ethena'],
    ['Pendle', {}, true, 'ethena'],
    ['Pendle', {}, false, 'single'],
    ['EtherFi', {}, false, 'single'],
  ])(
    'selects the %s implementation for config %o and cooldown %s',
    (provider, overrides, useEthenaCooldown, expectedKind) => {
      const config = { ...baseConfig, ...overrides };
      expect(
        getEarnProtocol(provider).resolveWithdraw({ config, useEthenaCooldown })
          .kind,
      ).toBe(expectedKind);
    },
  );

  it.each([
    [
      'Lido',
      { unstakeWithSignMessage: true },
      false,
      false,
      ['permit', 'unstake'],
    ],
    ['Stakefish', {}, false, false, ['signWithdrawal', 'build', 'withdraw']],
    ['Pendle', {}, true, false, ['swap', 'settlement', 'unstake']],
    ['Pendle', {}, true, true, ['unstake']],
    ['EtherFi', {}, false, false, ['withdraw']],
  ])(
    'plans %s withdrawal using the selected protocol definition',
    (
      provider,
      overrides,
      useEthenaCooldown,
      resumeEthenaCooldownUnstake,
      ids,
    ) => {
      const config = { ...baseConfig, ...overrides };
      const plan = getUniversalWithdrawProtocolPlan({
        provider,
        config,
        useEthenaCooldown,
        resumeEthenaCooldownUnstake,
      });
      expect(plan.steps.map((step) => step.id)).toEqual(ids);
    },
  );

  it('keeps sign-only approval handoff unsupported, even on the cooldown route', () => {
    expect(() =>
      getUniversalWithdrawProtocolPlan({
        provider: 'Babylon',
        config: { ...baseConfig, withdrawSignOnly: true },
        useEthenaCooldown: true,
      }),
    ).toThrow('Unsupported withdrawal approval workflow');
  });
});
