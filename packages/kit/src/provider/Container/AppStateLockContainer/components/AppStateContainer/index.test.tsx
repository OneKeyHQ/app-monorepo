/**
 * @jest-environment jsdom
 */

import { AppStateContainer } from '.';

import { act, render } from '@testing-library/react';

// The web overlay renders with react-native-web, as the app does on web.
jest.mock('react-native', () =>
  jest.requireActual<typeof import('react-native')>('react-native-web'),
);

jest.mock('@onekeyhq/components', () => ({
  Portal: {
    Container: ({ name }: { name: string }) => (
      <div data-testid="portal-container" data-name={name} />
    ),
    Constant: {
      APP_STATE_LOCK_CONTAINER_OVERLAY: 'APP_STATE_LOCK_CONTAINER_OVERLAY',
    },
  },
}));

// jsdom has no Web Animations; the lock host does not animate, but the web
// overlay still fades its backdrop layer.
beforeAll(() => {
  Element.prototype.animate = function animate() {
    return {
      finished: Promise.resolve(),
      cancel: () => undefined,
    } as unknown as Animation;
  };
  Element.prototype.getAnimations = () => [];
});

describe('AppStateContainer (web)', () => {
  it('hosts the lock screen and its dialog portal in the lock overlay layer', async () => {
    render(
      <AppStateContainer>
        <div data-testid="lock-screen" />
      </AppStateContainer>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    const lockScreen = document.querySelector('[data-testid="lock-screen"]');
    const portalContainer = document.querySelector(
      '[data-testid="portal-container"]',
    );
    expect(portalContainer?.getAttribute('data-name')).toBe(
      'APP_STATE_LOCK_CONTAINER_OVERLAY',
    );

    const bodyChildren = Array.from(document.body.children);
    const lockRoot = bodyChildren.find((child) => child.contains(lockScreen));
    expect(lockRoot?.getAttribute('data-onekey-overlay-layer')).toBe('lock');
    // A dialog rendered into the portal has to end up in the same body child as
    // the lock screen: the lock screen marks every *other* body child inert, so
    // a dialog that lands beside it is visible but unusable. (OK-62416)
    expect(lockRoot?.contains(portalContainer as Node)).toBe(true);
  });
});
