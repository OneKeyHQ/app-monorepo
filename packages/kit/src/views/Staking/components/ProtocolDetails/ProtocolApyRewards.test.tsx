/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ProtocolApyRewards } from './ProtocolApyRewards';

jest.mock('@onekeyhq/components', () => {
  const Box = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Anchor: Box,
    Icon: Box,
    SizableText: Box,
    XStack: Box,
    YStack: Box,
  };
});
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/views/Staking/components/utils', () => ({
  formatApy: (value: string | number) => value,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));

describe('protocol APY details', () => {
  const apys = {
    dailyApy: '3',
    weeklyNetApy: '5',
    airdrop: '7',
    performanceFee: '0',
    rewards: {},
    rebateReward: '0',
  };

  it('shows Falcon airdrop and fixed-yield details only while its event is active', () => {
    const { rerender } = render(
      <ProtocolApyRewards
        providerName="FALCON"
        apys={apys}
        eventEndTime={Date.now() + 60_000}
      />,
    );
    expect(screen.getByText(ETranslations.earn_base_apy)).toBeTruthy();
    expect(
      screen.getByText(ETranslations.earn_falcon_token_airdrop),
    ).toBeTruthy();
    expect(screen.getByText(ETranslations.earn_fixed_yield_info)).toBeTruthy();

    rerender(
      <ProtocolApyRewards providerName="falcon" apys={apys} eventEndTime={1} />,
    );
    expect(screen.getByText(ETranslations.earn_base_apy)).toBeTruthy();
    expect(
      screen.queryByText(ETranslations.earn_falcon_token_airdrop),
    ).toBeNull();
    expect(screen.queryByText(ETranslations.earn_fixed_yield_info)).toBeNull();
  });

  it('keeps the vault breakdown for vault providers and no breakdown for others', () => {
    const { rerender } = render(
      <ProtocolApyRewards providerName="MoRpHo" apys={apys} />,
    );
    expect(screen.getByText(ETranslations.earn_native_apy)).toBeTruthy();
    expect(screen.queryByText(ETranslations.earn_base_apy)).toBeNull();

    rerender(<ProtocolApyRewards providerName="other" apys={apys} />);
    expect(screen.queryByText(ETranslations.earn_native_apy)).toBeNull();
    expect(screen.queryByText(ETranslations.earn_base_apy)).toBeNull();
  });
});
