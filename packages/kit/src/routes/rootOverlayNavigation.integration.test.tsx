/** @jest-environment jsdom */
import { useLayoutEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';

import {
  OverlayStore,
  OverlayView,
  overlayStore,
} from '@onekeyfe/react-native-native-overlay';
import {
  BaseNavigationContainer,
  createNavigationContainerRef,
  createNavigatorFactory,
  useNavigationBuilder,
} from '@react-navigation/core';
import { StackActions, StackRouter } from '@react-navigation/routers';
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
import { RootStackNavigator } from '../../../components/src/layouts/Navigation/Navigator/RootStackNavigator';
import { PageOverlayOwner } from '../../../components/src/layouts/Page/PageOverlayOwner';

import { withOverlayPageHost } from './withOverlayPageHost';

import type { ParamListBase } from '@react-navigation/core';
import type { createStackNavigator } from '@react-navigation/stack';

jest.mock('@react-navigation/native', () =>
  jest.requireActual<typeof import('@react-navigation/core')>(
    '@react-navigation/core',
  ),
);
jest.mock('react-native', () =>
  jest.requireActual<typeof import('react-native')>('react-native-web'),
);
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/components/src/hooks/useStyle', () => ({
  useMedia: () => ({ md: false }),
  useTheme: () => ({ bg: { val: 'white' } }),
}));
jest.mock(
  '../../../components/src/layouts/Navigation/GlobalScreenOptions',
  () => ({
    clearStackNavigatorOptions: () => ({}),
    makeFullScreenOptions: () => ({}),
    makeModalScreenOptions: () => ({}),
    makeOnboardingScreenOptions: () => ({}),
    makeWebviewScreenOptions: () => ({}),
  }),
);
jest.mock('../../../components/src/layouts/Navigation/StackNavigator', () => ({
  createStackNavigator: () =>
    createNavigatorFactory(TestStackNavigator)() as ReturnType<
      typeof createStackNavigator<ParamListBase>
    >,
}));

function TestStackNavigator({
  children,
  ...options
}: PropsWithChildren<Parameters<typeof useNavigationBuilder>[1]>) {
  const { state, descriptors, navigation, NavigationContent } =
    useNavigationBuilder(StackRouter, { ...options, children });
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
        <div
          key={route.key}
          aria-hidden={route.key !== state.routes[state.index].key}
        >
          {descriptors[route.key].render()}
        </div>
      ))}
    </NavigationContent>
  );
}
const NestedStack = createNavigatorFactory(TestStackNavigator)() as ReturnType<
  typeof createStackNavigator<ParamListBase>
>;
const navigation = createNavigationContainerRef<ParamListBase>();
const animation = {
  enter: { type: 'none' as const },
  exit: { type: 'none' as const },
};

let mockSetLateOpen: (open: boolean) => void;
let mockSetSecureOpen: (open: boolean) => void;
function MainPage() {
  const [open, setOpen] = useState(true);
  const [lateOpen, setLateOpen] = useState(false);
  const [secureOpen, setSecureOpen] = useState(false);
  useLayoutEffect(() => {
    mockSetLateOpen = setLateOpen;
    mockSetSecureOpen = setSecureOpen;
  }, []);
  return (
    <PageOverlayOwner>
      <OverlayView
        visible={open}
        scope="page"
        animation={animation}
        dismissOnBackPress
        onRequestDismiss={() => setOpen(false)}
      >
        <input aria-label="Deposit amount" defaultValue="1000" />
      </OverlayView>
      <OverlayView visible={lateOpen} scope="page" animation={animation}>
        <input aria-label="Late background amount" />
      </OverlayView>
      <OverlayView visible={secureOpen} level="secure" animation={animation}>
        <input aria-label="Secure amount" />
      </OverlayView>
    </PageOverlayOwner>
  );
}
function ReceivePage() {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    input.current?.focus();
  }, []);
  return (
    <PageOverlayOwner>
      <input ref={input} aria-label="Receive amount" />
      <button type="button" onClick={() => setOpen(true)}>
        Open child Dialog
      </button>
      <OverlayView
        visible={open}
        scope="page"
        animation={animation}
        dismissOnBackPress
        onRequestDismiss={() => setOpen(false)}
      >
        <input aria-label="Child amount" defaultValue="123" />
      </OverlayView>
    </PageOverlayOwner>
  );
}
const DetailsPage = () => (
  <PageOverlayOwner>
    <input aria-label="Details amount" />
  </PageOverlayOwner>
);
const Main = withOverlayPageHost(MainPage);
const Modal = withOverlayPageHost(() => (
  <NestedStack.Navigator>
    <NestedStack.Screen name="Receive" component={ReceivePage} />
    <NestedStack.Screen name="Details" component={DetailsPage} />
  </NestedStack.Navigator>
));
const WebView = withOverlayPageHost(() => (
  <PageOverlayOwner>
    <input aria-label="WebView amount" />
  </PageOverlayOwner>
));
const config = [
  { name: ERootRoutes.Main, component: Main, initialRoute: true },
  { name: ERootRoutes.Modal, component: Modal, type: 'modal' as const },
  { name: ERootRoutes.WebView, component: WebView, type: 'webView' as const },
];
const isInert = (element: HTMLElement) => {
  for (let node: HTMLElement | null = element; node; node = node.parentElement)
    if (node.inert) return true;
  return false;
};
function mount() {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);
  return render(
    <BaseNavigationContainer ref={navigation}>
      <RootStackNavigator config={config} />
    </BaseNavigationContainer>,
    { container: root },
  );
}
function escape(element: HTMLElement) {
  fireEvent.keyDown(element, { key: 'Escape' });
  fireEvent.keyUp(element, { key: 'Escape' });
}
beforeAll(() => {
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
  Element.prototype.animate = () =>
    ({ finished: Promise.resolve(), cancel: () => {} }) as unknown as Animation;
  Element.prototype.getAnimations = () => [];
});
afterEach(() => {
  cleanup();
  document.getElementById('root')?.remove();
  overlayStore.setFocusedPageHost(undefined);
});

it('keeps the deposit visible and its draft mounted while modal route input receives focus and normal keys', async () => {
  mount();
  const amount = await screen.findByLabelText('Deposit amount');
  fireEvent.change(amount, { target: { value: '1001' } });
  amount.focus();
  const original = overlayStore.getBlockingTop();
  expect(original).toBeDefined();
  for (let cycle = 0; cycle < 2; cycle += 1) {
    act(() => navigation.navigate(ERootRoutes.Modal));
    const receive = await screen.findByLabelText('Receive amount');
    await waitFor(() => {
      expect(isInert(amount)).toBe(true);
      expect(isInert(receive)).toBe(false);
      expect(document.activeElement).toBe(receive);
    });
    expect(getComputedStyle(amount).visibility).toBe('visible');
    expect(overlayStore.getBlockingTop()).toBeUndefined();
    expect(overlayStore.resolveBack()).toEqual({ kind: 'pass' });
    const listener = jest.fn();
    globalThis.addEventListener('keydown', listener);
    fireEvent.keyDown(receive, { key: 'm' });
    fireEvent.keyDown(receive, { key: 'Enter' });
    globalThis.removeEventListener('keydown', listener);
    expect(listener).toHaveBeenCalledTimes(2);
    escape(receive);
    expect(navigation.getCurrentRoute()?.name).toBe(ERootRoutes.Main);
    await waitFor(() => {
      expect(isInert(amount)).toBe(false);
      expect(overlayStore.getBlockingTop()?.id).toBe(original?.id);
      expect(document.activeElement).toBe(amount);
    });
    expect(screen.getByLabelText('Deposit amount')).toBe(amount);
    expect((amount as HTMLInputElement).value).toBe('1001');
  }
});
it('closes only the current real Dialog before nested and root navigation handle Escape', async () => {
  mount();
  act(() => navigation.navigate(ERootRoutes.Modal));
  fireEvent.click(await screen.findByText('Open child Dialog'));
  const child = await screen.findByLabelText('Child amount');
  expect(overlayStore.getBlockingTop()?.hostKey).toBe(
    navigation.getRootState().routes[1].key,
  );
  escape(child);
  await waitFor(() =>
    expect(screen.queryByLabelText('Child amount')).toBeNull(),
  );
  expect(navigation.getCurrentRoute()?.name).toBe('Receive');
  act(() => navigation.navigate('Details'));
  const details = await screen.findByLabelText('Details amount');
  escape(details);
  expect(navigation.getCurrentRoute()?.name).toBe('Receive');
  escape(screen.getByLabelText('Receive amount'));
  expect(navigation.getCurrentRoute()?.name).toBe(ERootRoutes.Main);
});
it('preserves child Dialog identity, order and draft across a WebView round trip', async () => {
  mount();
  act(() => navigation.navigate(ERootRoutes.Modal));
  fireEvent.click(await screen.findByText('Open child Dialog'));
  const child = await screen.findByLabelText('Child amount');
  fireEvent.change(child, { target: { value: '124' } });
  child.focus();
  const entry = overlayStore.getBlockingTop();
  act(() => navigation.navigate(ERootRoutes.WebView));
  await screen.findByLabelText('WebView amount');
  await waitFor(() => expect(isInert(child)).toBe(true));
  expect(overlayStore.getBlockingTop()).toBeUndefined();
  act(() => navigation.goBack());
  await waitFor(() => {
    expect(isInert(child)).toBe(false);
    expect(overlayStore.getBlockingTop()?.id).toBe(entry?.id);
    expect(document.activeElement).toBe(child);
  });
  expect(overlayStore.getBlockingTop()?.seq).toBe(entry?.seq);
  expect(screen.getByLabelText('Child amount')).toBe(child);
  expect((child as HTMLInputElement).value).toBe('124');
});
it('retains legacy selection and lets the focused host with no entry pass through', () => {
  const store = new OverlayStore();
  const old = store.request({
    scope: 'page',
    hostKey: 'z-main',
    ownerKey: 'main',
  });
  expect(store.getBlockingTop()?.id).toBe(old.id);
  store.setFocusedPageHost('a-receive');
  expect(store.getBlockingTop()).toBeUndefined();
  expect(store.resolveBack()).toEqual({ kind: 'pass' });
  expect(store.getEntry(old.id)?.suspended).toBe(false);
  const lock = store.request({
    scope: 'global',
    level: 'lock',
    dismissible: false,
  });
  expect(store.resolveBack()).toEqual({ kind: 'block' });
  expect(store.getBlockingTop()?.id).toBe(lock.id);
  store.finalize(lock.id);
  store.setFocusedPageHost(null);
  expect(store.getBlockingTop()).toBeUndefined();
  store.setFocusedPageHost(undefined);
  expect(store.getBlockingTop()?.id).toBe(old.id);
  store.finalize(old.id);
});

it('prevents delayed background Dialog presentation and dismissal from stealing route focus', async () => {
  mount();
  act(() => navigation.navigate(ERootRoutes.Modal));
  const receive = await screen.findByLabelText('Receive amount');
  expect(document.activeElement).toBe(receive);
  act(() => mockSetLateOpen(true));
  const late = await screen.findByLabelText('Late background amount');
  expect(isInert(late)).toBe(true);
  expect(document.activeElement).toBe(receive);
  expect(overlayStore.getBlockingTop()).toBeUndefined();
  act(() => mockSetLateOpen(false));
  await waitFor(() =>
    expect(screen.queryByLabelText('Late background amount')).toBeNull(),
  );
  expect(document.activeElement).toBe(receive);
});
it('keeps global security blocking through route changes and does not restore an inactive route input', async () => {
  mount();
  act(() => navigation.navigate(ERootRoutes.Modal));
  const receive = await screen.findByLabelText('Receive amount');
  act(() => mockSetSecureOpen(true));
  const secure = await screen.findByLabelText('Secure amount');
  secure.focus();
  expect(document.getElementById('root')?.inert).toBe(true);
  expect(overlayStore.getBlockingTop()?.level).toBe('secure');
  act(() => navigation.navigate(ERootRoutes.WebView));
  await screen.findByLabelText('WebView amount');
  expect(document.getElementById('root')?.inert).toBe(true);
  expect(document.activeElement).toBe(secure);
  act(() => mockSetSecureOpen(false));
  await waitFor(() =>
    expect(screen.queryByLabelText('Secure amount')).toBeNull(),
  );
  expect(document.getElementById('root')?.inert).toBe(false);
  expect(document.activeElement).not.toBe(receive);
  expect(overlayStore.resolveBack()).toEqual({ kind: 'pass' });
});

it('hands interaction between two root modals with the same name and restores the first Dialog', async () => {
  mount();
  act(() => navigation.dispatch(StackActions.push(ERootRoutes.Modal)));
  fireEvent.click(await screen.findByText('Open child Dialog'));
  const child = await screen.findByLabelText('Child amount');
  child.focus();
  fireEvent.change(child, { target: { value: '125' } });
  const original = overlayStore.getBlockingTop();
  const firstKey = navigation.getRootState().routes[1].key;
  act(() => navigation.dispatch(StackActions.push(ERootRoutes.Modal)));
  const routes = navigation.getRootState().routes;
  expect(routes).toHaveLength(3);
  expect(routes[2].name).toBe(routes[1].name);
  expect(routes[2].key).not.toBe(firstKey);
  const inputs = screen.getAllByLabelText('Receive amount');
  expect(inputs).toHaveLength(2);
  const receive = inputs[1];
  fireEvent.change(receive, { target: { value: '456' } });
  expect((receive as HTMLInputElement).value).toBe('456');
  expect(isInert(receive)).toBe(false);
  expect(isInert(child)).toBe(true);
  expect(getComputedStyle(child).visibility).toBe('visible');
  expect(overlayStore.getBlockingTop()).toBeUndefined();
  escape(receive);
  expect(navigation.getRootState().routes).toHaveLength(2);
  await waitFor(() => {
    expect(overlayStore.getBlockingTop()?.id).toBe(original?.id);
    expect(isInert(child)).toBe(false);
    expect(document.activeElement).toBe(child);
  });
  expect(overlayStore.getBlockingTop()?.seq).toBe(original?.seq);
  expect((child as HTMLInputElement).value).toBe('125');
});
