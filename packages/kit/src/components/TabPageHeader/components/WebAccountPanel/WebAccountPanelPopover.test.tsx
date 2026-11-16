/** @jest-environment jsdom */

import type { ComponentType, ReactNode } from 'react';

import { fireEvent, render, waitFor } from '@testing-library/react';

import type { IActivityHubOpenReferral } from '@onekeyhq/kit/src/components/ActivityHub';

const mockReferralModuleLoaded = jest.fn();
const mockReferralOwnerMounted = jest.fn();
const mockReferralOwnerUnmounted = jest.fn();
const mockOpenReferralPage = jest.fn();
const mockDarkThemeOpenReferralPage = jest.fn();
let mockTheme: 'light' | 'dark' = 'light';
const mockConfig = { sceneName: 'home' };

jest.mock('@onekeyhq/kit/src/hooks/useReferFriends', () => {
  mockReferralModuleLoaded();
  return {
    useOpenReferralPage: () => {
      const { useEffect } = jest.requireActual<typeof import('react')>('react');
      useEffect(() => {
        mockReferralOwnerMounted();
        return () => {
          mockReferralOwnerUnmounted();
        };
      }, []);
      return mockTheme === 'light'
        ? mockOpenReferralPage
        : mockDarkThemeOpenReferralPage;
    },
  };
});

jest.mock('@onekeyhq/components', () => ({
  Popover: ({
    renderTrigger,
    renderContent: Content,
  }: {
    renderTrigger: ReactNode;
    renderContent: ComponentType<{ closePopover: () => Promise<void> }>;
  }) => {
    const { useState } = jest.requireActual<typeof import('react')>('react');
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)}>
          {renderTrigger}
        </button>
        {open ? (
          <Content
            closePopover={async () => {
              setOpen(false);
            }}
          />
        ) : null}
      </div>
    );
  },
}));

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorProvider',
  () => ({
    AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
      children,
  }),
);

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/atoms',
  () => ({
    useAccountSelectorContextData: () => ({ config: mockConfig }),
  }),
);

jest.mock('@onekeyhq/kit/src/components/ActivityHub', () => ({
  ActivityHubAction: () => null,
  ActivityHubContent: () => null,
  shouldShowActivityHubInvitePanel: () => false,
  useShowActivityHub: () => jest.fn(),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsCommonConfigPersistAtom: () => [{ perpConfigCommon: {} }],
}));

jest.mock(
  '@onekeyhq/kit/src/views/Perp/components/PerpsCampaignIllustration',
  () => ({ PerpsCampaignIllustration: () => null }),
);

jest.mock('./WebAccountPanelPopoverContent', () => ({
  __esModule: true,
  default: function MockWebAccountPanelPopoverContent({
    initialView,
    closePopover,
    onOpenPerpsReferral,
  }: {
    initialView: string;
    closePopover: () => Promise<void>;
    onOpenPerpsReferral?: IActivityHubOpenReferral;
  }) {
    const { useState } = jest.requireActual<typeof import('react')>('react');
    const [view, setView] = useState(initialView);
    return (
      <div>
        <span>{view}</span>
        <button type="button" onClick={() => setView('settings')}>
          Settings
        </button>
        {onOpenPerpsReferral ? (
          <button
            type="button"
            onClick={() => {
              void closePopover().then(() => onOpenPerpsReferral());
            }}
          >
            Referral
          </button>
        ) : null}
      </div>
    );
  },
}));

function loadPopover() {
  return jest.requireActual<typeof import('./WebAccountPanelPopover')>(
    './WebAccountPanelPopover',
  ).WebAccountPanelPopover;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTheme = 'light';
});

it('keeps referral code out of the synchronous account-panel import', () => {
  jest.isolateModules(() => {
    loadPopover();
  });

  expect(mockReferralModuleLoaded).not.toHaveBeenCalled();
});

it('keeps the Perps referral owner mounted after the menu closes and the header rerenders', async () => {
  const WebAccountPanelPopover = loadPopover();
  const view = render(
    <WebAccountPanelPopover
      renderTrigger={<span>Account</span>}
      showPerpsActivityCenter
    />,
  );

  fireEvent.click(await view.findByRole('button', { name: 'Account' }));
  fireEvent.click(await view.findByRole('button', { name: 'Referral' }));
  await waitFor(() => expect(mockOpenReferralPage).toHaveBeenCalledTimes(1));

  expect(view.queryByRole('button', { name: 'Referral' })).toBeNull();
  expect(mockReferralOwnerMounted).toHaveBeenCalledTimes(1);
  expect(mockReferralOwnerUnmounted).not.toHaveBeenCalled();

  view.rerender(
    <WebAccountPanelPopover
      renderTrigger={<span>Account</span>}
      showPerpsActivityCenter
    />,
  );
  expect(mockReferralOwnerMounted).toHaveBeenCalledTimes(1);
  expect(mockReferralOwnerUnmounted).not.toHaveBeenCalled();

  view.unmount();
  expect(mockReferralOwnerUnmounted).toHaveBeenCalledTimes(1);
});

it('leaves the ordinary settings panel without a referral owner', async () => {
  const WebAccountPanelPopover = loadPopover();
  const view = render(
    <WebAccountPanelPopover
      initialView="settings"
      renderTrigger={<span>Settings</span>}
    />,
  );

  fireEvent.click(view.getByRole('button', { name: 'Settings' }));
  expect(await view.findByText('settings')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Referral' })).toBeNull();
  expect(mockReferralOwnerMounted).not.toHaveBeenCalled();
});

it.each([true, false])(
  'preserves the settings subpage when theme-dependent callbacks change (Perps: %s)',
  async (showPerpsActivityCenter) => {
    const WebAccountPanelPopover = loadPopover();
    const panel = (
      <WebAccountPanelPopover
        renderTrigger={<span>Account</span>}
        showPerpsActivityCenter={showPerpsActivityCenter}
      />
    );
    const view = render(panel);

    fireEvent.click(await view.findByRole('button', { name: 'Account' }));
    fireEvent.click(await view.findByRole('button', { name: 'Settings' }));
    expect(view.getByText('settings')).toBeTruthy();

    mockTheme = 'dark';
    view.rerender(
      <WebAccountPanelPopover
        renderTrigger={<span>Account</span>}
        showPerpsActivityCenter={showPerpsActivityCenter}
      />,
    );
    expect(view.getByText('settings')).toBeTruthy();

    if (showPerpsActivityCenter) {
      fireEvent.click(view.getByRole('button', { name: 'Referral' }));
      await waitFor(() =>
        expect(mockDarkThemeOpenReferralPage).toHaveBeenCalledTimes(1),
      );
      expect(mockOpenReferralPage).not.toHaveBeenCalled();
      expect(mockReferralOwnerUnmounted).not.toHaveBeenCalled();
    } else {
      expect(mockReferralOwnerMounted).not.toHaveBeenCalled();
    }
  },
);
