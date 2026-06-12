/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, import/first, vars-on-top, no-var */

// UpdatePreview first-frame force-lock tests
//
// Regression coverage for the jotai persist hydration race (PR #11704).
// The page seeds `updateInfo` from the useAppUpdatePersistAtom() snapshot,
// which during the race is still the non-force placeholder on first paint.
// Deriving the lock purely from that snapshot would leave a *mandatory*
// (force) update briefly dismissible until fetchAppUpdateInfo() resolves.
// The route param — derived from authoritative state at navigation time —
// must win on the first frame.
//
// yarn jest packages/kit/src/views/AppUpdate/pages/UpdatePreview.test.tsx

jest.mock('@react-navigation/core', () => {
  const fn = jest.fn();
  (globalThis as any).__usePreventRemove = fn;
  return { usePreventRemove: fn };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

// The root jest.config maps `@onekeyhq/components` AND every deeper subpath
// (including `.../src/content/Markdown`) to the same componentsMock.ts via an
// unanchored regex, so a single factory must expose every named export both
// import paths need — otherwise a second jest.mock for a subpath would
// clobber this one (same resolved file).
jest.mock('@onekeyhq/components', () => {
  const React = require('react');
  const Passthrough = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);
  const Page: any = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);
  Page.Header = () => null;
  Page.Body = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);
  return {
    Page,
    ScrollView: Passthrough,
    SizableText: Passthrough,
    YStack: Passthrough,
    Markdown: () => null,
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  // Pre-hydration placeholder: non-force (manual = 2), version 0.0.0.
  const holder = {
    value: { status: 'done', updateStrategy: 2, latestVersion: '0.0.0' },
  };
  (globalThis as any).__atomHolder = holder;
  return { useAppUpdatePersistAtom: () => [holder.value] };
});

jest.mock('@onekeyhq/shared/src/appUpdate', () => ({
  displayAppUpdateVersion: () => 'v',
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy({}, { get: (_t, p) => p }),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { appUpdate: { changelogViewed: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isExtension: false },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => {
  const fetchAppUpdateInfo = jest.fn();
  (globalThis as any).__fetchAppUpdateInfo = fetchAppUpdateInfo;
  return {
    __esModule: true,
    default: { serviceAppUpdate: { fetchAppUpdateInfo } },
  };
});

// force = 1 per EUpdateStrategy; mirror the real predicate.
jest.mock('../../../components/AppUpdate', () => ({
  isForceUpdateStrategy: (strategy: number) => strategy === 1,
}));

jest.mock('../components/UpdatePreviewActionButton', () => ({
  UpdatePreviewActionButton: () => null,
}));

jest.mock('../components/ViewUpdateHistory', () => ({
  ViewUpdateHistory: () => null,
}));

import { render } from '@testing-library/react';

import UpdatePreview from './UpdatePreview';

const g = globalThis as any;
const usePreventRemove = g.__usePreventRemove as jest.Mock;
const atomHolder = g.__atomHolder as { value: any };
const fetchAppUpdateInfo = g.__fetchAppUpdateInfo as jest.Mock;

function renderPreview(params: Record<string, unknown>) {
  return render(
    // route is the only prop the page reads.
    <UpdatePreview route={{ params } as any} {...({} as any)} />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset the placeholder snapshot before each test.
  atomHolder.value = {
    status: 'done',
    updateStrategy: 2,
    latestVersion: '0.0.0',
  };
  // Default: fetch never resolves during the test so we observe the
  // first-frame lock value without the post-fetch re-render.
  fetchAppUpdateInfo.mockReturnValue(new Promise(() => {}));
});

describe('UpdatePreview first-frame force lock', () => {
  test('force route param locks the page on first render even while the atom is still the non-force placeholder', () => {
    renderPreview({ isForceUpdate: true, latestVersion: '2.0.0' });

    // usePreventRemove(true, ...) must fire on the very first render — the
    // mandatory update cannot be dismissible during the hydration window.
    expect(usePreventRemove).toHaveBeenCalled();
    expect(usePreventRemove.mock.calls[0][0]).toBe(true);
  });

  test('non-force open stays unlocked on first render (no over-locking)', () => {
    renderPreview({ isForceUpdate: false, latestVersion: '2.0.0' });

    expect(usePreventRemove).toHaveBeenCalled();
    expect(usePreventRemove.mock.calls[0][0]).toBe(false);
  });
});
