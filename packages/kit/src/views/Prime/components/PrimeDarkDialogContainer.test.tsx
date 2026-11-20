/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PrimeDarkDialogContainer } from './PrimeDarkDialogContainer';

let mockPortalHost: HTMLDivElement;
const mockClose = jest.fn(async () => undefined);

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { createPortal } = jest.requireActual(
    'react-dom',
  ) as typeof import('react-dom');
  return {
    Theme: ({ children }: { children?: ReactNode }) => <>{children}</>,
    DialogContainer: React.forwardRef(function MockDialogContainer(
      {
        floatingPanelProps,
        renderContent,
      }: {
        floatingPanelProps?: { className?: string; width?: number };
        renderContent?: ReactNode;
      },
      _ref,
    ) {
      return createPortal(
        <div
          data-testid="prime-dialog-card"
          className={floatingPanelProps?.className}
          style={{ width: floatingPanelProps?.width }}
        >
          {renderContent}
        </div>,
        mockPortalHost,
      );
    }),
  };
});

beforeEach(() => {
  platformEnv.isNative = false;
  mockPortalHost = document.createElement('div');
  mockPortalHost.className = 't_light';
  document.body.appendChild(mockPortalHost);
});
afterEach(() => {
  mockPortalHost.remove();
  platformEnv.isNative = false;
});

it('puts the dark theme on the measured web card without adding a portal wrapper', () => {
  const { getByTestId } = render(
    <PrimeDarkDialogContainer
      onClose={mockClose}
      floatingPanelProps={{ className: 'custom-card', width: 420 }}
      renderContent={<span>Benefits</span>}
    />,
  );
  const card = getByTestId('prime-dialog-card');
  expect(card.classList.contains('t_dark')).toBe(true);
  expect(card.classList.contains('custom-card')).toBe(true);
  expect(card.parentElement).toBe(mockPortalHost);
  expect(card.style.width).toBe('420px');
  expect(card.textContent).toBe('Benefits');
});

it('keeps native card props unchanged', () => {
  platformEnv.isNative = true;
  const { getByTestId } = render(
    <PrimeDarkDialogContainer
      onClose={mockClose}
      floatingPanelProps={{ className: 'native-card' }}
    />,
  );
  const card = getByTestId('prime-dialog-card');
  expect(card.className).toBe('native-card');
  expect(card.parentElement).toBe(mockPortalHost);
});
