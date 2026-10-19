/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import {
  SHEET_AND_DIALOG_Z_INDEX,
  WC_PAY_DIALOG_Z_INDEX,
} from '@onekeyhq/shared/src/consts/zIndexConsts';

// The shell is pure wiring onto the shared Dialog: the mocked container
// records the props it receives and the portal records where it renders.
const mockDialogContainer = jest.fn(
  (_props: Record<string, unknown>): ReactNode => null,
);
const mockPortalContainers: string[] = [];

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  return {
    __esModule: true,
    Button: Passthrough,
    Dialog: { ScrollView: Passthrough },
    DialogContainer: (props: Record<string, unknown>) =>
      mockDialogContainer(props),
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

describe('WcPayDialogShell', () => {
  beforeEach(() => {
    mockDialogContainer.mockClear();
    mockPortalContainers.length = 0;
  });

  it('renders in the full-window overlay as a bare dialog with the scene inset', () => {
    const shellProps = renderShell({ dismissible: true });

    expect(mockPortalContainers).toEqual(['FULL_WINDOW_OVERLAY_PORTAL']);
    expect(shellProps).toMatchObject({
      showHeader: false,
      showFooter: false,
      contentContainerProps: { px: '$6', pt: '$4' },
    });
    // DialogContainer drops plain children; the steps must arrive through
    // renderContent or the sheet opens blank.
    expect(shellProps.renderContent).toBeTruthy();
  });

  it('pins its z-index below the dialog stack on both presentations', () => {
    const shellProps = renderShell({ dismissible: true });

    expect(WC_PAY_DIALOG_Z_INDEX).toBeLessThan(SHEET_AND_DIALOG_Z_INDEX);
    expect(shellProps.sheetProps).toEqual({ zIndex: WC_PAY_DIALOG_Z_INDEX });
    expect(shellProps.floatingPanelProps).toEqual({
      zIndex: WC_PAY_DIALOG_Z_INDEX,
    });
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
