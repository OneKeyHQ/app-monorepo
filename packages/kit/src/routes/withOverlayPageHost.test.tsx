/** @jest-environment jsdom */

import {
  OverlayView,
  overlayStore,
} from '@onekeyfe/react-native-native-overlay';
import { NavigationRouteContext } from '@react-navigation/native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { withOverlayPageHost } from './withOverlayPageHost';

import type { NavigationState } from '@react-navigation/native';

const mockState = {
  index: 0,
  routes: [{ key: 'main', name: 'main' }],
};

jest.mock('@react-navigation/native', () => ({
  NavigationRouteContext: jest
    .requireActual<typeof import('react')>('react')
    .createContext(undefined),
  useNavigationState: (selector: (state: NavigationState) => unknown) =>
    selector(mockState as NavigationState),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
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

const mainRoute = { key: 'main', name: 'main' };
const receiveRoute = { key: 'modal-z-receive', name: 'modal' };
const swapRoute = { key: 'modal-a-swap', name: 'modal' };
const animation = { enter: { type: 'none' as const } };
const Main = withOverlayPageHost(() => (
  <OverlayView visible scope="page" ownerKey="perp" animation={animation}>
    <input aria-label="Deposit amount" defaultValue="1000" />
  </OverlayView>
));
const onSwap = jest.fn();
const Receive = withOverlayPageHost(() => (
  <button type="button" onClick={onSwap}>
    Swap
  </button>
));
const Swap = withOverlayPageHost(() => <input aria-label="Swap amount" />);

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

it('hands interaction to a root modal without hiding or remounting the deposit', async () => {
  const page = (open: boolean, swapOpen = false) => (
    <>
      <NavigationRouteContext.Provider value={mainRoute}>
        <Main />
      </NavigationRouteContext.Provider>
      {open ? (
        <NavigationRouteContext.Provider value={receiveRoute}>
          <Receive />
        </NavigationRouteContext.Provider>
      ) : null}
      {swapOpen ? (
        <NavigationRouteContext.Provider value={swapRoute}>
          <Swap />
        </NavigationRouteContext.Provider>
      ) : null}
    </>
  );
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);
  const view = render(page(false), { container: root });
  const amount = await screen.findByLabelText('Deposit amount');
  for (let cycle = 0; cycle < 2; cycle += 1) {
    mockState.routes.push(receiveRoute);
    mockState.index = 1;
    view.rerender(page(true));
    const swap = await screen.findByRole('button', { name: 'Swap' });
    await waitFor(() => {
      expect(isInert(swap)).toBe(false);
      expect(isInert(amount)).toBe(true);
    });
    expect(getComputedStyle(amount).visibility).toBe('visible');
    fireEvent.click(swap);
    expect(onSwap).toHaveBeenCalledTimes(cycle + 1);
    mockState.routes.push(swapRoute);
    mockState.index = 2;
    view.rerender(page(true, true));
    const swapAmount = await screen.findByLabelText('Swap amount');
    await waitFor(() => {
      expect(isInert(swapAmount)).toBe(false);
      expect(isInert(swap)).toBe(true);
    });
    mockState.routes.pop();
    mockState.index = 1;
    view.rerender(page(true));
    await waitFor(() => expect(isInert(swap)).toBe(false));
    mockState.routes.pop();
    mockState.index = 0;
    view.rerender(page(false));
    await waitFor(() => expect(isInert(amount)).toBe(false));
    expect(screen.getByLabelText('Deposit amount')).toBe(amount);
    expect((amount as HTMLInputElement).value).toBe('1000');
  }
  view.unmount();
  root.remove();
  expect(overlayStore.getBlockingTop()).toBeUndefined();
});
