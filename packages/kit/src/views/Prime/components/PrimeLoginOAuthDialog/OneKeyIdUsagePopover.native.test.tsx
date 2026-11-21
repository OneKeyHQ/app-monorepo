/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
// oxlint-disable react-perf/jsx-no-new-function-as-prop -- test host state
import type { ReactNode } from 'react';
import { useState } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { OneKeyIdUsagePopover } from './OneKeyIdUsagePopover';

// Runs the real usage popover on the real native Popover in an expanded
// (iPad-wide) window. Only layout and native presentation are stood in for.
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeIOS: true, isNativeAndroid: false },
}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useNestedOverlayLevel: () => 'modal',
  OverlayView: ({ visible }: { visible: boolean }) => (
    <div data-testid="anchored-overlay" data-visible={String(visible)} />
  ),
}));
jest.mock('@tamagui/core', () => ({
  useIsomorphicLayoutEffect:
    jest.requireActual<typeof import('react')>('react').useLayoutEffect,
}));
jest.mock('@react-navigation/elements', () => ({
  HeaderHeightContext: jest
    .requireActual<typeof import('react')>('react')
    .createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0 }),
}));
jest.mock(
  '@onekeyhq/shared/src/modules/DualScreenInfo/isFoldableIPhone',
  () => ({ isFoldableIPhone: () => false }),
);
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { ui: {} },
}));
jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  useWindowDimensions: () => ({ width: 1024, height: 768 }),
  Platform: {
    OS: 'ios',
    select: (specifics: {
      ios?: unknown;
      native?: unknown;
      default?: unknown;
    }) => specifics.ios ?? specifics.native ?? specifics.default,
  },
}));

function MockBox({
  children,
  testID,
  onLayout,
}: {
  children?: ReactNode;
  testID?: string;
  onLayout?: (event: { nativeEvent: { layout: { height: number } } }) => void;
}) {
  const React = jest.requireActual<typeof import('react')>('react');
  React.useLayoutEffect(() => {
    onLayout?.({ nativeEvent: { layout: { height: 72 } } });
  }, [onLayout]);
  return <div data-testid={testID}>{children}</div>;
}
jest.mock('../../../../../../components/src/primitives', () => ({
  Stack: MockBox,
  XStack: MockBox,
  YStack: MockBox,
  SizableText: MockBox,
}));
jest.mock('../../../../../../components/src/hooks', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useModalNavigatorContext: () => ({}),
    ModalNavigatorContext: React.createContext({}),
  };
});
jest.mock(
  '../../../../../../components/src/hooks/useDeferredGuideBlocker',
  () => ({
    useDeferredGuideBlocker: jest.fn(),
  }),
);
jest.mock(
  '../../../../../../components/src/hooks/useOverlayWidthClass',
  () => ({
    OVERLAY_SHEET_MAX_WIDTH: 540,
    useOverlayWidthClass: () => 'expanded',
  }),
);
jest.mock('../../../../../../components/src/layouts/Page/PageContext', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { usePageContext: () => ({}), PageContext: React.createContext({}) };
});
jest.mock('../../../../../../components/src/layouts/ScrollView', () => ({
  // Reports the fitted content height, as the native scroll view would.
  ScrollView: ({
    children,
    innerViewRef,
  }: {
    children?: ReactNode;
    innerViewRef?: {
      current: {
        measure: (
          callback: (x: number, y: number, w: number, h: number) => void,
        ) => void;
      };
    };
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useLayoutEffect(() => {
      if (innerViewRef) {
        innerViewRef.current = {
          measure: (callback) => {
            callback(0, 0, 400, 240);
          },
        };
      }
    });
    return <div>{children}</div>;
  },
}));
jest.mock(
  '../../../../../../components/src/hocs/NativeSheetPresentation',
  () => ({
    NativeSheetPresentation: ({
      children,
      open,
      onOpenChange,
    }: {
      children?: ReactNode;
      open: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => (
      <div data-testid="native-sheet" data-open={String(open)}>
        <button type="button" onClick={() => onOpenChange?.(false)}>
          Dismiss sheet
        </button>
        {children}
      </div>
    ),
  }),
);
jest.mock('../../../../../../components/src/content/Keyboard', () => ({
  Keyboard: { dismissWithDelay: jest.fn() },
}));
jest.mock(
  '../../../../../../components/src/content/GlassButtonCapsule',
  () => ({
    GlassButtonCapsule: ({ children }: { children?: ReactNode }) => (
      <>{children}</>
    ),
  }),
);
jest.mock('../../../../../../components/src/actions/IconButton', () => ({
  IconButton: () => null,
}));
jest.mock('../../../../../../components/src/utils/getFontSize', () => ({
  NATIVE_HIT_SLOP: {},
}));
jest.mock(
  '../../../../../../components/src/actions/Popover/useNativePortalLifecycle',
  () =>
    jest.requireActual<
      typeof import('../../../../../../components/src/actions/Popover/useNativePortalLifecycle.native')
    >(
      '../../../../../../components/src/actions/Popover/useNativePortalLifecycle.native',
    ),
);
jest.mock(
  '../../../../../../components/src/actions/Popover/popoverSideEffects',
  () => ({
    runPopoverOpenSideEffects: jest.fn(),
    runPopoverCloseSideEffects: jest.fn(),
  }),
);
// Jest maps every `@onekeyhq/components*` import, including the native
// Popover's own `@onekeyhq/components/src/shared/tamagui`, to one module, so
// this mock serves both; component internals are mocked by relative path.
jest.mock('@onekeyhq/components', () => ({
  getTokenValue: () => 240,
  withStaticProperties: Object.assign,
  // Resolved on use, after the mocks it depends on are registered.
  get Popover() {
    return jest.requireActual<
      typeof import('../../../../../../components/src/actions/Popover/index.native')
    >('../../../../../../components/src/actions/Popover/index.native').Popover;
  },
  Icon: ({ name }: { name: string }) => <span data-icon={name} />,
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  YStack: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
  // Wide window: web would anchor; native must still use the sheet.
  useMedia: () => ({ md: false, gtMd: true }),
}));

function Host() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        What is OneKey ID?
      </button>
      <OneKeyIdUsagePopover
        open={open}
        onOpenChange={setOpen}
        hoverable={false}
      />
    </>
  );
}

// Each step commits React updates before the next frame, so work scheduled
// from a commit (the portal mount, the fitted-height frames) gets to run.
function settle(frames = 10) {
  for (let i = 0; i < frames; i += 1) {
    act(() => {
      jest.advanceTimersByTime(16);
    });
  }
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

it('opens the usage sheet on the first press in a wide native window', () => {
  render(<Host />);
  expect(screen.queryByTestId('native-sheet')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'What is OneKey ID?' }));
  settle();

  expect(screen.getByTestId('native-sheet').dataset.open).toBe('true');
  expect(screen.queryByTestId('anchored-overlay')).toBeNull();
  // The sheet header carries the title, so the content does not repeat it.
  expect(screen.getAllByText('onekey_id_usage__title')).toHaveLength(1);
  for (const id of [
    'onekey_id_usage_keyless__desc',
    'onekey_id_usage_prime__desc',
    'onekey_id_usage_referral__desc',
  ]) {
    expect(screen.getByText(id)).toBeTruthy();
  }

  settle(60);
  expect(screen.getByTestId('native-sheet').dataset.open).toBe('true');
});

it('closes and reopens the usage sheet', () => {
  render(<Host />);
  fireEvent.click(screen.getByRole('button', { name: 'What is OneKey ID?' }));
  settle();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss sheet' }));
  settle(60);
  expect(screen.queryByTestId('native-sheet')?.dataset.open ?? 'false').toBe(
    'false',
  );

  fireEvent.click(screen.getByRole('button', { name: 'What is OneKey ID?' }));
  settle();
  expect(screen.getByTestId('native-sheet').dataset.open).toBe('true');
});
