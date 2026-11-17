/** @jest-environment jsdom */

import * as React from 'react';

import { render } from '@testing-library/react';

import { AppPagerContent } from './AppPagerContent';

// The web pager SDK reports width 0 until the page owner has been measured
// (OK-66299); each test drives that value directly.
let mockPageWidth = 0;

function mockPage({
  children,
  ref,
  width,
}: React.PropsWithChildren<{
  ref?: React.Ref<HTMLDivElement>;
  width?: number;
}>) {
  return (
    <div ref={ref} data-testid="page" data-width={width ?? 'auto'}>
      {children}
    </div>
  );
}

jest.mock('@onekeyhq/components', () => ({
  ...jest.requireActual<
    typeof import('../../../../components/src/composite/ScrollContentRegistration')
  >('../../../../components/src/composite/ScrollContentRegistration'),
  YStack: mockPage,
}));
jest.mock('react-native-pager-view', () => ({
  useWebCollapsiblePagerPage: () => ({
    isFocused: true,
    owner: null,
    content: null,
    contentHeight: undefined,
    width: mockPageWidth,
    height: 400,
    scrollTop: 0,
  }),
}));

describe('AppPagerContent page width (web)', () => {
  beforeEach(() => {
    mockPageWidth = 0;
  });

  it('stretches an unmeasured page instead of pinning it to width 0', () => {
    const screen = render(
      <AppPagerContent>
        <span>$2.45</span>
      </AppPagerContent>,
    );
    expect(screen.getByTestId('page').getAttribute('data-width')).toBe('auto');
    screen.unmount();
  });

  it('pins the page width once the owner has been measured', () => {
    // A fresh element per render, otherwise React bails out on the same
    // element reference and never re-reads the mocked SDK width.
    const content = () => (
      <AppPagerContent>
        <span>$2.45</span>
      </AppPagerContent>
    );
    const screen = render(content());
    expect(screen.getByTestId('page').getAttribute('data-width')).toBe('auto');
    mockPageWidth = 390;
    screen.rerender(content());
    expect(screen.getByTestId('page').getAttribute('data-width')).toBe('390');
    screen.unmount();
  });
});
