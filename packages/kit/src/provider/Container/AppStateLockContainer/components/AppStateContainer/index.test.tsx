/**
 * @jest-environment jsdom
 */

import { AppStateContainer } from '.';

import { render } from '@testing-library/react';

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

describe('AppStateContainer (web)', () => {
  it('hosts the lock screen and its dialog portal in one document.body child', () => {
    render(
      <AppStateContainer>
        <div data-testid="lock-screen" />
      </AppStateContainer>,
    );

    const lockScreen = document.querySelector('[data-testid="lock-screen"]');
    const portalContainer = document.querySelector(
      '[data-testid="portal-container"]',
    );
    expect(portalContainer?.getAttribute('data-name')).toBe(
      'APP_STATE_LOCK_CONTAINER_OVERLAY',
    );

    const bodyChildren = Array.from(document.body.children);
    const lockRoot = bodyChildren.find((child) => child.contains(lockScreen));
    expect(lockRoot).toBeTruthy();
    // A dialog rendered into the portal has to end up in the same body child as
    // the lock screen: the lock screen marks every *other* body child inert, so
    // a dialog that lands beside it is visible but unusable. (OK-62416)
    expect(lockRoot?.contains(portalContainer as Node)).toBe(true);
  });

  it('fills the viewport so absolutely positioned children resolve against it', () => {
    render(
      <AppStateContainer>
        <div data-testid="lock-screen" />
      </AppStateContainer>,
    );

    const lockRoot = Array.from(document.body.children).find((child) =>
      child.contains(document.querySelector('[data-testid="lock-screen"]')),
    ) as HTMLElement;

    // `document.body` is a flex container in the app, so without this the root
    // collapses to a zero-width flex item and a sheet-form dialog resolves its
    // static position against that — landing one viewport to the side.
    expect(lockRoot.style.position).toBe('absolute');
    expect(lockRoot.style.top).toBe('0px');
    expect(lockRoot.style.left).toBe('0px');
    expect(lockRoot.style.right).toBe('0px');
    expect(lockRoot.style.bottom).toBe('0px');
  });
});
