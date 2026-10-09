/** @jest-environment jsdom */

import {
  OverlayView,
  overlayStore,
} from '@onekeyfe/react-native-native-overlay';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorMirrorInspector } from './AccountSelectorMirrorInspector';
import { AccountSelectorMirrorInspectorTestIDs } from './AccountSelectorMirrorInspectorTestIDs';

import type { IAccountSelectorMirrorInspectorSnapshot } from './AccountSelectorMirrorInspectorObserver';

jest.mock('react-native', () =>
  jest.requireActual<typeof import('react-native')>('react-native-web'),
);

beforeAll(() => {
  Element.prototype.animate = function animate() {
    return {
      finished: Promise.resolve(),
      cancel: () => undefined,
    } as unknown as Animation;
  };
  Element.prototype.getAnimations = () => [];
});

const baseState = {
  active: {
    accountName: 'Account 1',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    deriveType: 'default',
    indexedAccountId: 'indexed-account-1',
    networkId: 'evm--1',
    othersWalletAccountId: undefined,
    ready: true,
    walletId: 'wallet-1',
  },
  selected: {
    deriveType: 'default',
    indexedAccountId: 'indexed-account-1',
    networkId: 'evm--1',
    othersWalletAccountId: undefined,
    walletId: 'wallet-1',
  },
};

const mockSnapshot: IAccountSelectorMirrorInspectorSnapshot = {
  observedAt: 10_000,
  reports: [
    {
      actual: baseState,
      consumerStatus: 'notObserved',
      contextStatus: 'fail',
      enabledNum: [0],
      expected: {
        ...baseState,
        selected: { ...baseState.selected, networkId: 'evm--137' },
      },
      findings: [
        {
          actual: 'evm--1',
          expected: 'evm--137',
          field: 'selected.networkId',
          reason:
            'The mounted Context selection differs from the canonical store.',
          status: 'fail',
        },
      ],
      instanceId: 7,
      num: 0,
      observedAt: 10_000,
      overallStatus: 'fail',
      perfDebugName: 'home-page',
      persistenceStatus: 'notObserved',
      probeName: 'home-page',
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: '',
      storageReady: true,
      syncLoading: false,
      transition: {
        activeReloadId: 4,
        activeScheduleId: 4,
        activeTrigger: 'selectedAccountChanged',
        selectedReason: 'userSelectNetwork',
        transitionId: 3,
        updatedAt: 3,
      },
    },
  ],
  summary: {
    contextOnly: 0,
    failed: 1,
    fullyVerified: 0,
    mountedMirrors: 1,
    pending: 0,
  },
};

jest.mock('./AccountSelectorMirrorInspectorObserver', () => ({
  getAccountSelectorMirrorInspectorSnapshot: () => mockSnapshot,
  subscribeAccountSelectorMirrorInspector: () => () => undefined,
}));

describe('AccountSelectorMirrorInspector', () => {
  it.each(['secure', 'lock'] as const)(
    'keeps the debug inspector operable above a %s overlay without blocking it',
    async (level) => {
      const onClose = jest.fn();
      const { unmount } = render(
        <>
          <OverlayView
            visible
            level={level}
            presentation="fullscreen"
            backdrop={false}
            animation={{ enter: { type: 'none' } }}
          >
            <button data-testid="blocking-content" type="button">
              Synthetic blocking overlay
            </button>
          </OverlayView>
          <AccountSelectorMirrorInspector onClose={onClose} />
        </>,
      );
      const inspector = screen.getByTestId(
        AccountSelectorMirrorInspectorTestIDs.root,
      );
      await waitFor(() => {
        expect(
          inspector
            .closest('[data-onekey-overlay-layer]')
            ?.getAttribute('data-onekey-overlay-layer'),
        ).toBe('debug');
        expect(overlayStore.getBlockingTop()?.level).toBe(level);
      });
      for (const content of [
        inspector,
        screen.getByTestId('blocking-content'),
      ]) {
        for (
          let node: HTMLElement | null = content;
          node;
          node = node.parentElement
        ) {
          expect(node.inert).toBeFalsy();
        }
      }
      fireEvent.click(
        screen.getByTestId(AccountSelectorMirrorInspectorTestIDs.toggle),
      );
      expect(
        screen.getByTestId(AccountSelectorMirrorInspectorTestIDs.list),
      ).toBeTruthy();
      fireEvent.click(
        screen.getByTestId(AccountSelectorMirrorInspectorTestIDs.close),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
      unmount();
      await waitFor(() =>
        expect(overlayStore.getBlockingTop()).toBeUndefined(),
      );
    },
  );

  it('renders collapsed, expands reports, and exposes failure details', () => {
    const onClose = jest.fn();
    const { container } = render(
      <AccountSelectorMirrorInspector onClose={onClose} />,
    );

    expect(
      screen.getByTestId(AccountSelectorMirrorInspectorTestIDs.root),
    ).toBeTruthy();
    expect(
      screen.queryByTestId(AccountSelectorMirrorInspectorTestIDs.list),
    ).toBeNull();
    expect(
      screen.getByTestId(AccountSelectorMirrorInspectorTestIDs.summary)
        .textContent,
    ).toContain('M 1');
    expect(
      screen.getByTestId(AccountSelectorMirrorInspectorTestIDs.summary)
        .textContent,
    ).toContain('F 1');

    fireEvent.click(
      screen.getByTestId(AccountSelectorMirrorInspectorTestIDs.toggle),
    );
    expect(
      screen.getByTestId(AccountSelectorMirrorInspectorTestIDs.list),
    ).toBeTruthy();
    const slot = screen.getByTestId(
      AccountSelectorMirrorInspectorTestIDs.slot(7, 0),
    );
    expect(slot.getAttribute('data-status')).toBe('fail');
    fireEvent.click(within(slot).getByText(/Show findings/));
    const findings = screen.getByTestId(
      AccountSelectorMirrorInspectorTestIDs.findings(7, 0),
    );
    expect(findings.textContent).toContain('expected: evm--137');
    expect(findings.textContent).toContain('actual: evm--1');

    const testIDs = [
      ...container.ownerDocument.querySelectorAll('[data-testid]'),
    ].map((element) => element.getAttribute('data-testid'));
    expect(new Set(testIDs).size).toBe(testIDs.length);

    fireEvent.click(
      screen.getByTestId(AccountSelectorMirrorInspectorTestIDs.close),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
