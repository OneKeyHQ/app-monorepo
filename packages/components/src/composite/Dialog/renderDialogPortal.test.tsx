/**
 * @jest-environment jsdom
 */

import { isValidElement } from 'react';
import type { ReactElement } from 'react';

import { renderDialogPortal } from './renderDialogPortal';

jest.mock('../../hocs', () => {
  const render = jest.fn(() => ({ destroy: jest.fn(), update: jest.fn() }));
  return {
    __render: render,
    EPortalContainerConstantName: {
      FULL_WINDOW_OVERLAY_PORTAL: 'FULL_WINDOW_OVERLAY_PORTAL',
      APP_STATE_LOCK_CONTAINER_OVERLAY: 'APP_STATE_LOCK_CONTAINER_OVERLAY',
    },
    Portal: {
      Render: render,
      Constant: {
        FULL_WINDOW_OVERLAY_PORTAL: 'FULL_WINDOW_OVERLAY_PORTAL',
        APP_STATE_LOCK_CONTAINER_OVERLAY: 'APP_STATE_LOCK_CONTAINER_OVERLAY',
      },
    },
  };
});

jest.mock('../../layouts/OverlayContainer', () => ({
  OverlayContainer: ({ children }: { children?: unknown }) => children,
}));

jest.mock('./renderToContainer', () => {
  const renderToContainer = jest.fn(() => ({
    destroy: jest.fn(),
    update: jest.fn(),
  }));
  return { __renderToContainer: renderToContainer, renderToContainer };
});

function getMocks() {
  return {
    render: jest.requireMock('../../hocs').__render as jest.Mock,
    renderToContainer: jest.requireMock('./renderToContainer')
      .__renderToContainer as jest.Mock,
    OverlayContainer: jest.requireMock('../../layouts/OverlayContainer')
      .OverlayContainer as unknown,
  };
}

const element = (<div data-testid="dialog" />) as ReactElement;

describe('renderDialogPortal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gives a container-less dialog its own overlay when it asks to be on top', () => {
    renderDialogPortal({ element, isOverTopAllViews: true });

    expect(getMocks().renderToContainer).not.toHaveBeenCalled();
    const [container, rendered] = getMocks().render.mock.calls[0] as [
      string,
      ReactElement,
    ];
    expect(container).toBe('FULL_WINDOW_OVERLAY_PORTAL');
    // Not the bare element: it is wrapped, which on iOS is the extra
    // FullWindowOverlay that lands above a native modal page.
    expect(isValidElement(rendered)).toBe(true);
    expect(rendered.type).toBe(getMocks().OverlayContainer);
    expect((rendered.props as { children: ReactElement }).children).toBe(
      element,
    );
  });

  it('leaves a container-less dialog in the default portal otherwise', () => {
    renderDialogPortal({ element });

    const [container, rendered] = getMocks().render.mock.calls[0] as [
      string,
      ReactElement,
    ];
    expect(container).toBe('FULL_WINDOW_OVERLAY_PORTAL');
    expect(rendered).toBe(element);
  });

  it('defers to renderToContainer when a container is named', () => {
    renderDialogPortal({
      element,
      portalContainer: 'APP_STATE_LOCK_CONTAINER_OVERLAY' as never,
      isOverTopAllViews: false,
    });

    expect(getMocks().render).not.toHaveBeenCalled();
    expect(getMocks().renderToContainer).toHaveBeenCalledWith(
      'APP_STATE_LOCK_CONTAINER_OVERLAY',
      element,
      false,
    );
  });

  it('returns the manager of the portal it rendered, so the dialog can tear it down', () => {
    const manager = renderDialogPortal({ element, isOverTopAllViews: true });

    expect(manager).toBe(getMocks().render.mock.results[0].value);
    expect(typeof manager.destroy).toBe('function');
  });
});
