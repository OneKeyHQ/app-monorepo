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
});
