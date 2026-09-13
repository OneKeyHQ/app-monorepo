/** @jest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { ScrollView as ReactNativeWebScrollView } from 'react-native';

// jest-expo supplies a React Native mock; use the configured RNW mapping here.
jest.unmock('react-native');

const mockPlatformEnv = {
  isNative: false,
};
const CALLER_DATA_SET = { owner: 'caller' };
const SCROLLBAR_ATTRIBUTE = 'data-onekey-scroll-view-scrollbar';
const WEB_STYLES = readFileSync(
  resolve(__dirname, '../../../../shared/src/web/index.css'),
  'utf8',
);

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
      screen.getByTestId('scroll-view').getAttribute(SCROLLBAR_ATTRIBUTE),
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
      screen.getByTestId('scroll-view').getAttribute(SCROLLBAR_ATTRIBUTE),
    ).toBe('visible');
  });

  it('updates the web scrollbar when the indicator is toggled', () => {
    const { rerender } = render(<ScrollView testID="scroll-view" />);

    expect(
      screen.getByTestId('scroll-view').getAttribute(SCROLLBAR_ATTRIBUTE),
    ).toBe('hidden');

    rerender(<ScrollView showsVerticalScrollIndicator testID="scroll-view" />);

    expect(
      screen.getByTestId('scroll-view').getAttribute(SCROLLBAR_ATTRIBUTE),
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
      screen.getByTestId('scroll-view').getAttribute(SCROLLBAR_ATTRIBUTE),
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

  it('does not let React Native Web hide the opposite indicator', () => {
    render(
      <>
        <ReactNativeWebScrollView
          horizontal
          showsHorizontalScrollIndicator
          showsVerticalScrollIndicator={false}
          testID="rnw-hidden-scroll-view"
        />
        <ReactNativeWebScrollView
          horizontal
          showsHorizontalScrollIndicator
          showsVerticalScrollIndicator
          testID="rnw-visible-scroll-view"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          showsVerticalScrollIndicator={false}
          testID="scroll-view"
        />
      </>,
    );

    const rnwHiddenClassNames = new Set(
      screen.getByTestId('rnw-hidden-scroll-view').className.split(' '),
    );
    const rnwVisibleClassNames = new Set(
      screen.getByTestId('rnw-visible-scroll-view').className.split(' '),
    );
    const scrollViewClassNames = new Set(
      screen.getByTestId('scroll-view').className.split(' '),
    );
    const rnwHiddenOnlyClassNames = [...rnwHiddenClassNames].filter(
      (className) => !rnwVisibleClassNames.has(className),
    );

    expect(rnwHiddenOnlyClassNames).not.toHaveLength(0);
    expect(
      rnwHiddenOnlyClassNames.some((className) =>
        scrollViewClassNames.has(className),
      ),
    ).toBe(false);
  });

  it('keeps the DOM attribute and web selectors in sync', () => {
    render(<ScrollView showsVerticalScrollIndicator testID="scroll-view" />);

    expect(
      document.querySelector(`[${SCROLLBAR_ATTRIBUTE}="visible"]`),
    ).not.toBeNull();
    expect(WEB_STYLES).toContain(`[${SCROLLBAR_ATTRIBUTE}='visible']`);
    expect(WEB_STYLES).toContain(`[${SCROLLBAR_ATTRIBUTE}='hidden']`);
  });

  it('does not add web scrollbar data on native', () => {
    mockPlatformEnv.isNative = true;

    render(<ScrollView showsVerticalScrollIndicator testID="scroll-view" />);

    expect(
      screen.getByTestId('scroll-view').getAttribute(SCROLLBAR_ATTRIBUTE),
    ).toBeNull();
  });
});
