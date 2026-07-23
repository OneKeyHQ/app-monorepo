/* eslint-disable import/first */

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const { Text, View } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');

  return {
    Alert: View,
    Icon: View,
    SizableText: Text,
    Skeleton: View,
    XStack: View,
    YStack: View,
  };
});

jest.mock('@onekeyhq/kit/src/views/Borrow/components/BorrowInfoItem', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { View } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');

  return {
    BorrowInfoItem: ({ children }: { children: import('react').ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText',
  () => {
    const React = jest.requireActual('react') as typeof import('react');
    const { Text } = jest.requireActual(
      'react-native',
    ) as typeof import('react-native');

    return {
      EarnText: ({ text }: { text?: { text?: string } }) =>
        React.createElement(Text, null, text?.text),
    };
  },
);

import { render } from '@testing-library/react-native';

import type { IBorrowEModeSwitchCheck } from '@onekeyhq/shared/types/staking';

import { EModeImpactSection } from './EModeImpactSection';

describe('EModeImpactSection', () => {
  it('shows the weighted account LTV for the current mode', () => {
    const view = render(
      <EModeImpactSection
        isCurrent
        check={null}
        isChecking={false}
        currentMaxLtv="81.55"
        currentHealthFactor={{ text: '1.5' }}
        currentHealthFactorLoading={false}
      />,
    );

    const output = JSON.stringify(view.toJSON());
    expect(output).toContain('81.55%');
    expect(output).not.toContain('90%');
  });

  it('masks unverified target metrics while preserving risk alerts', () => {
    const check: IBorrowEModeSwitchCheck = {
      canSwitch: true,
      reasons: [],
      disableCollateralAssets: [],
      repayAssets: [],
      additionalRepayAssets: [],
      collateral: {},
      debt: {},
      maxLtv: {
        current: { title: { text: '78.63%' } },
        latest: { title: { text: '90.00%' } },
      },
      healthFactor: {
        current: { title: { text: '22.39' } },
        latest: {
          title: { text: '24.18', color: '$textCritical' },
        },
      },
    };
    const view = render(
      <EModeImpactSection
        isCurrent={false}
        check={check}
        isChecking={false}
        currentHealthFactorLoading={false}
      />,
    );

    const output = JSON.stringify(view.toJSON());
    expect(output).toContain('78.63%');
    expect(output).toContain('22.39');
    expect(output).toContain('—');
    expect(
      view.UNSAFE_root.findAll(
        (node) => node.props.title === 'defi_emode_risk_near_liquidation',
      ),
    ).toHaveLength(1);
    expect(output).not.toContain('90.00%');
    expect(output).not.toContain('24.18');
  });
});
