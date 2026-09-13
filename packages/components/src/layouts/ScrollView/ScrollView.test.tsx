/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

const mockPlatformEnv = {
  isNative: false,
};
const CALLER_DATA_SET = { owner: 'caller' };

jest.mock('react-native', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const MockScrollView = React.forwardRef<
    HTMLDivElement,
    {
      children?: React.ReactNode;
      dataSet?: Record<string, string>;
      testID?: string;
    }
  >(({ children, dataSet, testID }, ref) =>
    React.createElement(
      'div',
      {
        ref,
        'data-onekey-scroll-view-scrollbar': dataSet?.onekeyScrollViewScrollbar,
        'data-owner': dataSet?.owner,
        'data-testid': testID,
      },
      children,
    ),
  );

  MockScrollView.displayName = 'MockScrollView';

  return {
    ScrollView: MockScrollView,
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: mockPlatformEnv,
}));

jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  usePropsAndStyle: ({ style, ...props }: { style?: unknown }) => [
    props,
    style,
  ],
  useStyle: (style: unknown) => style,
}));

const { ScrollView } = require('.') as typeof import('.');

describe('ScrollView scroll indicators', () => {
  beforeEach(() => {
    mockPlatformEnv.isNative = false;
  });

  it('shows the horizontal scrollbar when explicitly enabled', () => {
    render(
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        showsVerticalScrollIndicator={false}
        testID="scroll-view"
      />,
    );

    expect(
      screen
        .getByTestId('scroll-view')
        .getAttribute('data-onekey-scroll-view-scrollbar'),
    ).toBe('visible');
  });

  it('shows the vertical scrollbar when explicitly enabled', () => {
    render(
      <ScrollView
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator
        testID="scroll-view"
      />,
    );

    expect(
      screen
        .getByTestId('scroll-view')
        .getAttribute('data-onekey-scroll-view-scrollbar'),
    ).toBe('visible');
  });

  it('updates the web scrollbar when the indicator is toggled', () => {
    const { rerender } = render(<ScrollView testID="scroll-view" />);

    expect(
      screen
        .getByTestId('scroll-view')
        .getAttribute('data-onekey-scroll-view-scrollbar'),
    ).toBe('hidden');

    rerender(<ScrollView showsVerticalScrollIndicator testID="scroll-view" />);

    expect(
      screen
        .getByTestId('scroll-view')
        .getAttribute('data-onekey-scroll-view-scrollbar'),
    ).toBe('visible');
  });

  it('keeps the web scrollbar hidden when explicitly disabled', () => {
    render(
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        testID="scroll-view"
      />,
    );

    expect(
      screen
        .getByTestId('scroll-view')
        .getAttribute('data-onekey-scroll-view-scrollbar'),
    ).toBe('hidden');
  });

  it('preserves caller data attributes', () => {
    render(
      <ScrollView
        dataSet={CALLER_DATA_SET}
        showsVerticalScrollIndicator
        testID="scroll-view"
      />,
    );

    expect(screen.getByTestId('scroll-view').getAttribute('data-owner')).toBe(
      'caller',
    );
  });

  it('does not add web scrollbar data on native', () => {
    mockPlatformEnv.isNative = true;

    render(<ScrollView showsVerticalScrollIndicator testID="scroll-view" />);

    expect(
      screen
        .getByTestId('scroll-view')
        .getAttribute('data-onekey-scroll-view-scrollbar'),
    ).toBeNull();
  });
});
