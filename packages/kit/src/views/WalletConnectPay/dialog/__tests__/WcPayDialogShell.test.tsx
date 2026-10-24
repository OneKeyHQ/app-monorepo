/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// The shell is pure wiring onto the shared Dialog: the mocked container
// records the props it receives and each time it mounts, and the portal
// records where it renders.
const mockDialogContainer = jest.fn(
  (_props: Record<string, unknown>): ReactNode => null,
);
const mockDialogContainerMounts = jest.fn();
const mockUseEffect = useEffect;
const mockPortalContainers: string[] = [];

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  function MockDialogContainer(props: Record<string, unknown>) {
    mockUseEffect(() => {
      mockDialogContainerMounts();
    }, []);
    return mockDialogContainer(props);
  }
  return {
    __esModule: true,
    Button: Passthrough,
    Dialog: { ScrollView: Passthrough },
    DialogContainer: MockDialogContainer,
    Icon: Passthrough,
    Image: Passthrough,
    Portal: {
      Body: ({
        container,
        children,
      }: {
        container: string;
        children: ReactNode;
      }) => {
        mockPortalContainers.push(container);
        return children;
      },
      Constant: { FULL_WINDOW_OVERLAY_PORTAL: 'FULL_WINDOW_OVERLAY_PORTAL' },
    },
    SizableText: Passthrough,
    Spinner: Passthrough,
    Stack: Passthrough,
    XStack: Passthrough,
    YStack: Passthrough,
  };
});

// The signing summary pulls in the crypto stack, which jsdom cannot load;
// the shell never renders a step that uses it.
jest.mock('../wcPaySigningSummary', () => ({
  __esModule: true,
  describeWcPaySigningHeadline: jest.fn(),
  describeWcPaySigningSummary: jest.fn(),
}));

import { WcPayDialogShell } from '../WcPayDialogScene';

function renderShell({
  open = true,
  dismissible,
  onClose = jest.fn(),
}: {
  open?: boolean;
  dismissible: boolean;
  onClose?: () => void;
}) {
  render(
    <WcPayDialogShell open={open} dismissible={dismissible} onClose={onClose}>
      <span>step</span>
    </WcPayDialogShell>,
  );
  const shellProps = mockDialogContainer.mock.calls.at(-1)?.[0];
  expect(shellProps).toBeDefined();
  return shellProps ?? {};
}

function renderParkAndReveal() {
  const onClose = jest.fn();
  const shell = (open: boolean) => (
    <WcPayDialogShell open={open} dismissible onClose={onClose}>
      <span>step</span>
    </WcPayDialogShell>
  );
  const { rerender } = render(shell(true));
  const mountsAfterOpen = mockDialogContainerMounts.mock.calls.length;
  rerender(shell(false));
  const mountsAfterPark = mockDialogContainerMounts.mock.calls.length;
  rerender(shell(true));
  const mountsAfterReveal = mockDialogContainerMounts.mock.calls.length;
  return { mountsAfterOpen, mountsAfterPark, mountsAfterReveal };
}

describe('WcPayDialogShell', () => {
  beforeEach(() => {
    mockDialogContainer.mockClear();
    mockDialogContainerMounts.mockClear();
    mockPortalContainers.length = 0;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('remounts the dialog on every reveal on iOS, never on park', () => {
    // iOS stacks full-window overlay views by mount order: a backdrop
    // mounted on reveal would sit on top of a sheet that stayed mounted.
    jest.replaceProperty(platformEnv, 'isNativeIOS', true);

    expect(renderParkAndReveal()).toEqual({
      mountsAfterOpen: 1,
      mountsAfterPark: 1,
      mountsAfterReveal: 2,
    });
  });

  it('keeps the same dialog across park and reveal off iOS', () => {
    jest.replaceProperty(platformEnv, 'isNativeIOS', false);

    expect(renderParkAndReveal()).toEqual({
      mountsAfterOpen: 1,
      mountsAfterPark: 1,
      mountsAfterReveal: 1,
    });
  });

  it('renders inline as a bare dialog with the scene inset', () => {
    const shellProps = renderShell({ dismissible: true });

    expect(mockPortalContainers).toEqual([]);
    expect(shellProps).toMatchObject({
      showHeader: false,
      showFooter: false,
      contentContainerProps: { px: '$6', pt: '$4' },
    });
    // DialogContainer drops plain children; the steps must arrive through
    // renderContent or the sheet opens blank.
    expect(shellProps.renderContent).toBeTruthy();
  });

  it('uses the modal lane below secure and hardware prompts', () => {
    const shellProps = renderShell({ dismissible: true });
    expect(shellProps.overlayLevel).toBe('modal');
  });

  it.each([true, false])(
    'ties every dismissal path to the view (dismissible: %s)',
    (dismissible) => {
      const shellProps = renderShell({ dismissible });

      expect(shellProps).toMatchObject({
        dismissOnOverlayPress: dismissible,
        disableDrag: !dismissible,
        disableSystemClose: !dismissible,
      });
      expect((shellProps.onBeforeClose as () => boolean)()).toBe(dismissible);
    },
  );

  it('passes open through and reports an allowed close through onClose', async () => {
    const onClose = jest.fn();
    const shellProps = renderShell({ open: false, dismissible: true, onClose });

    expect(shellProps.open).toBe(false);
    await (shellProps.onClose as () => Promise<void>)();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
