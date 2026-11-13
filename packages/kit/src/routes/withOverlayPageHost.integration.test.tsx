/** @jest-environment jsdom */

import { Fragment, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';

import {
  OverlayView,
  overlayStore,
  useOverlayPageScope,
} from '@onekeyfe/react-native-native-overlay';
import {
  BaseNavigationContainer,
  NavigationRouteContext,
  createNavigationContainerRef,
  createNavigatorFactory,
  useIsFocused,
  useNavigationBuilder,
} from '@react-navigation/core';
import { StackRouter } from '@react-navigation/routers';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

import { useBackHandler } from '../../../components/src/hooks/useBackHandler';

import { withOverlayPageHost } from './withOverlayPageHost';
import { withOverlayPageHost as withNativeOverlayPageHost } from './withOverlayPageHost.native';

import type { ParamListBase } from '@react-navigation/core';

jest.mock('@react-navigation/native', () =>
  jest.requireActual<typeof import('@react-navigation/core')>(
    '@react-navigation/core',
  ),
);
jest.mock('react-native', () =>
  jest.requireActual<typeof import('react-native')>('react-native-web'),
);

const nativeRoute = { key: 'native-modal', name: ERootRoutes.Modal };
const navigationRef = createNavigationContainerRef<ParamListBase>();
const animation = {
  enter: { type: 'none' as const },
  exit: { type: 'none' as const },
};
const listenerDescriptors = new Map(
  ['addEventListener', 'removeEventListener'].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]),
);

beforeAll(() => {
  // The shared Jest setup replaces these DOM methods with no-ops.
  Object.defineProperties(globalThis, {
    addEventListener: {
      configurable: true,
      writable: true,
      value: EventTarget.prototype.addEventListener.bind(globalThis),
    },
    removeEventListener: {
      configurable: true,
      writable: true,
      value: EventTarget.prototype.removeEventListener.bind(globalThis),
    },
  });
  Element.prototype.animate = function animate() {
    return {
      finished: Promise.resolve(),
      cancel: () => undefined,
    } as unknown as Animation;
  };
  Element.prototype.getAnimations = () => [];
});
afterAll(() => {
  for (const [name, descriptor] of listenerDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});
afterEach(() => {
  cleanup();
  document.getElementById('root')?.remove();
});

function TestStackNavigator({ children }: PropsWithChildren) {
  const { state, descriptors, navigation, NavigationContent } =
    useNavigationBuilder(StackRouter, { children });
  // Match the modal navigator's keyup handler to catch double-pop regressions.
  useBackHandler(
    () => {
      if (navigation.isFocused()) navigation.goBack();
      return true;
    },
    !!navigation.getParent(),
    false,
  );
  return (
    <NavigationContent>
      {state.routes.map((route) => (
        <Fragment key={route.key}>{descriptors[route.key].render()}</Fragment>
      ))}
    </NavigationContent>
  );
}
const Stack = createNavigatorFactory(TestStackNavigator)();
const Main = withOverlayPageHost(() => <input aria-label="Main amount" />);
const FullScreen = withOverlayPageHost(() => (
  <input aria-label="Full screen" />
));
const Details = () => <input aria-label="Details amount" />;

function Receive() {
  const [open, setOpen] = useState(false);
  const focused = useIsFocused();
  // Model the page owner's existing suspension when a full-screen route covers it.
  useEffect(() => {
    overlayStore.setPageVisible('receive-dialog', focused);
  }, [focused]);
  useEffect(() => () => overlayStore.removePage('receive-dialog'), []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <OverlayView
        visible={open}
        scope="page"
        ownerKey="receive-dialog"
        animation={animation}
        dismissOnBackPress
        onRequestDismiss={() => setOpen(false)}
      >
        <input aria-label="Dialog amount" defaultValue="1000" />
      </OverlayView>
    </>
  );
}
const Modal = withOverlayPageHost(() => (
  <Stack.Navigator>
    <Stack.Screen name="Receive" component={Receive} />
    <Stack.Screen name="Details" component={Details} />
  </Stack.Navigator>
));
function mountNavigation() {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);
  render(
    <BaseNavigationContainer ref={navigationRef}>
      <Stack.Navigator>
        <Stack.Screen name={ERootRoutes.Main} component={Main} />
        <Stack.Screen name={ERootRoutes.Modal} component={Modal} />
        <Stack.Screen name={ERootRoutes.WebView} component={FullScreen} />
      </Stack.Navigator>
    </BaseNavigationContainer>,
    { container: root },
  );
  act(() => navigationRef.navigate(ERootRoutes.Modal));
}
const escape = () => {
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.keyUp(document, { key: 'Escape' });
};
const isInert = (element: HTMLElement) => {
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.parentElement
  ) {
    if (node.inert) return true;
  }
  return false;
};

it('pops a nested modal page before closing the root modal on Escape', async () => {
  mountNavigation();
  await screen.findByRole('button', { name: 'Open dialog' });
  act(() => navigationRef.navigate('Details'));
  await screen.findByLabelText('Details amount');
  escape();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Receive');
  expect(navigationRef.getRootState().routes).toHaveLength(2);
  escape();
  expect(navigationRef.getCurrentRoute()?.name).toBe(ERootRoutes.Main);
  expect(navigationRef.getRootState().routes).toHaveLength(1);
  await waitFor(() => expect(overlayStore.getBlockingTop()).toBeUndefined());
});

it('dismisses a higher Dialog without also popping the modal on Escape', async () => {
  mountNavigation();
  fireEvent.click(await screen.findByRole('button', { name: 'Open dialog' }));
  await screen.findByLabelText('Dialog amount');
  escape();
  await waitFor(() =>
    expect(screen.queryByLabelText('Dialog amount')).toBeNull(),
  );
  expect(navigationRef.getCurrentRoute()?.name).toBe('Receive');
  expect(navigationRef.getRootState().routes).toHaveLength(2);
  escape();
  expect(navigationRef.getCurrentRoute()?.name).toBe(ERootRoutes.Main);
});

it('preserves Dialog order, draft and interaction after a full-screen round trip', async () => {
  mountNavigation();
  fireEvent.click(await screen.findByRole('button', { name: 'Open dialog' }));
  const amount = await screen.findByLabelText('Dialog amount');
  fireEvent.change(amount, { target: { value: '1001' } });
  const dialog = overlayStore.getBlockingTop();
  const modal = overlayStore
    .getSnapshot()
    .entries.find((entry) => entry.id !== dialog?.id);
  expect(dialog).toBeDefined();
  expect(modal).toBeDefined();
  act(() => navigationRef.navigate(ERootRoutes.WebView));
  await screen.findByLabelText('Full screen');
  await waitFor(() => {
    expect(overlayStore.getBlockingTop()).toBeUndefined();
    expect(isInert(amount)).toBe(true);
  });
  act(() => navigationRef.goBack());
  await waitFor(() => {
    expect(overlayStore.getBlockingTop()?.id).toBe(dialog?.id);
    expect(isInert(amount)).toBe(false);
  });
  expect(overlayStore.getSnapshot().entries).toContainEqual(
    expect.objectContaining({ id: modal?.id, seq: modal?.seq }),
  );
  expect(screen.getByLabelText('Dialog amount')).toBe(amount);
  expect((amount as HTMLInputElement).value).toBe('1001');
  amount.focus();
  expect(document.activeElement).toBe(amount);
  escape();
  await waitFor(() =>
    expect(screen.queryByLabelText('Dialog amount')).toBeNull(),
  );
  expect(navigationRef.getCurrentRoute()?.name).toBe('Receive');
});

it('keeps the native host key and does not add a web root-modal overlay', () => {
  const NativeModal = withNativeOverlayPageHost(() => {
    const { hostKey } = useOverlayPageScope();
    return <span>{hostKey}</span>;
  });
  render(
    <NavigationRouteContext.Provider value={nativeRoute}>
      <NativeModal />
    </NavigationRouteContext.Provider>,
  );
  expect(screen.getByText('native-modal')).toBeTruthy();
  expect(overlayStore.getSnapshot().entries).toHaveLength(0);
});
