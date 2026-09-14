/** @jest-environment jsdom */

import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { PerpOrderBookMobileVerticalShell } from './PerpOrderBookMobileVerticalShell';

jest.mock('@onekeyhq/components', () => ({
  YStack: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

describe('PerpOrderBookMobileVerticalShell', () => {
  it('keeps the funding header mounted while the order book reloads', () => {
    const onHeaderMount = jest.fn();
    const onHeaderUnmount = jest.fn();

    function FundingHeaderProbe() {
      useEffect(() => {
        onHeaderMount();
        return onHeaderUnmount;
      }, []);
      return null;
    }

    const { getByText, queryByText, rerender, unmount } = render(
      <PerpOrderBookMobileVerticalShell
        header={<FundingHeaderProbe />}
        isLoading
        loadingBody={<span>loading</span>}
        readyBody={<span>ready</span>}
      />,
    );

    expect(getByText('loading')).toBeTruthy();
    expect(queryByText('ready')).toBeNull();

    rerender(
      <PerpOrderBookMobileVerticalShell
        header={<FundingHeaderProbe />}
        isLoading={false}
        loadingBody={<span>loading</span>}
        readyBody={<span>ready</span>}
      />,
    );

    expect(getByText('ready')).toBeTruthy();
    expect(queryByText('loading')).toBeNull();

    rerender(
      <PerpOrderBookMobileVerticalShell
        header={<FundingHeaderProbe />}
        isLoading
        loadingBody={<span>loading</span>}
        readyBody={<span>ready</span>}
      />,
    );

    expect(onHeaderMount).toHaveBeenCalledTimes(1);
    expect(onHeaderUnmount).not.toHaveBeenCalled();

    unmount();
    expect(onHeaderUnmount).toHaveBeenCalledTimes(1);
  });
});
