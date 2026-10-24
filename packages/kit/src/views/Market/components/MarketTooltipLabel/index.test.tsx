/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { MarketTooltipLabel } from '.';

import { fireEvent, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Stack = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Stack,
    SizableText: Stack,
    // Native Tooltip only renders the trigger; DashText owns its press sheet.
    Tooltip: ({ renderTrigger }: { renderTrigger: ReactNode }) => renderTrigger,
    DashText: ({
      children,
      tooltip,
    }: {
      children: ReactNode;
      tooltip?: string;
    }) => {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(!open)}>
            {children}
          </button>
          {open && tooltip ? <div role="dialog">{tooltip}</div> : null}
        </>
      );
    },
  };
});

describe('MarketTooltipLabel', () => {
  it('opens an explanation when a native stock statistic is pressed', () => {
    const view = render(
      <MarketTooltipLabel tooltip="Shares traded divided by shares outstanding">
        Turnover
      </MarketTooltipLabel>,
    );
    expect(view.queryByRole('dialog')).toBeNull();
    fireEvent.click(view.getByRole('button', { name: 'Turnover' }));
    expect(view.getByRole('dialog').textContent).toBe(
      'Shares traded divided by shares outstanding',
    );
    fireEvent.click(view.getByRole('button', { name: 'Turnover' }));
    expect(view.queryByRole('dialog')).toBeNull();
  });

  it('keeps the desktop label on the outer hover tooltip', () => {
    Object.assign(platformEnv, { isNative: false });
    const view = render(
      <MarketTooltipLabel tooltip="Explanation">Turnover</MarketTooltipLabel>,
    );
    fireEvent.click(view.getByRole('button', { name: 'Turnover' }));
    expect(view.queryByRole('dialog')).toBeNull();
    Object.assign(platformEnv, { isNative: true });
  });
});
