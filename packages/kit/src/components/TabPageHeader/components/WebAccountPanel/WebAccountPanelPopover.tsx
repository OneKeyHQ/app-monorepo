import type { ReactNode } from 'react';
import { Suspense, lazy, useCallback, useState } from 'react';

import { Popover, Spinner, Stack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorProvider';
import type { IActivityHubOpenReferral } from '@onekeyhq/kit/src/components/ActivityHub';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/atoms';

import type { IWebAccountPanelView } from './WebAccountPanelPopoverContent';

export interface IWebAccountPanelPopoverProps {
  renderTrigger: ReactNode;
  initialView?: IWebAccountPanelView;
  connected?: boolean;
  showPerpsActivityCenter?: boolean;
}

const PANEL_WIDTH = 352;

const PANEL_ENABLED_NUM = [0];

const FLOATING_PANEL_PROPS = {
  width: PANEL_WIDTH,
  maxWidth: PANEL_WIDTH,
  p: 0,
  overflow: 'hidden',
  style: { transformOrigin: 'top right' },
} as const;

const LazyWebAccountPanelPopoverContent = lazy(
  () => import('./WebAccountPanelPopoverContent'),
);

const LazyPerpsReferralEntry = lazy(async () => {
  const { PerpsReferralEntry } =
    await import('@onekeyhq/kit/src/views/Perp/components/PerpsActivityCenterAction');
  return { default: PerpsReferralEntry };
});

type IWebAccountPanelPopoverBaseProps = Omit<
  IWebAccountPanelPopoverProps,
  'showPerpsActivityCenter'
> & {
  onOpenPerpsReferral?: IActivityHubOpenReferral;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isLoadingReferral?: boolean;
};

function WebAccountPanelPopoverBase({
  renderTrigger,
  initialView = 'main',
  connected = true,
  onOpenPerpsReferral,
  open,
  onOpenChange,
  isLoadingReferral = false,
}: IWebAccountPanelPopoverBaseProps) {
  const { config } = useAccountSelectorContextData();
  // Popover renders `renderContent` as a component (<RenderContent/> in
  // RawPopover), so React keys the whole panel subtree by this function's
  // identity. Memoizing keeps the identity stable while the header re-renders.
  const renderContent = useCallback(
    ({ closePopover }: { isOpen?: boolean; closePopover: () => void }) =>
      config ? (
        <AccountSelectorProviderMirror
          enabledNum={PANEL_ENABLED_NUM}
          config={config}
        >
          <Suspense fallback={null}>
            {isLoadingReferral ? (
              <Stack p="$5" ai="center">
                <Spinner />
              </Stack>
            ) : (
              <LazyWebAccountPanelPopoverContent
                initialView={initialView}
                connected={connected}
                closePopover={closePopover}
                onOpenPerpsReferral={onOpenPerpsReferral}
              />
            )}
          </Suspense>
        </AccountSelectorProviderMirror>
      ) : null,
    [config, initialView, connected, onOpenPerpsReferral, isLoadingReferral],
  );
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      title=""
      showHeader={false}
      placement="bottom-end"
      offset={6}
      floatingPanelProps={FLOATING_PANEL_PROPS}
      renderTrigger={renderTrigger}
      renderContent={renderContent}
    />
  );
}

function PerpsWebAccountPanelPopover(
  props: Omit<IWebAccountPanelPopoverProps, 'showPerpsActivityCenter'>,
) {
  // Keep the first click and any dismissal across the loading fallback.
  const [open, setOpen] = useState(false);
  return (
    <Suspense
      fallback={
        <WebAccountPanelPopoverBase
          {...props}
          open={open}
          onOpenChange={setOpen}
          isLoadingReferral
        />
      }
    >
      <LazyPerpsReferralEntry>
        {(openReferralPage) => (
          <WebAccountPanelPopoverBase
            {...props}
            open={open}
            onOpenChange={setOpen}
            onOpenPerpsReferral={openReferralPage}
          />
        )}
      </LazyPerpsReferralEntry>
    </Suspense>
  );
}

export function WebAccountPanelPopover({
  showPerpsActivityCenter = false,
  ...props
}: IWebAccountPanelPopoverProps) {
  return showPerpsActivityCenter ? (
    <PerpsWebAccountPanelPopover {...props} />
  ) : (
    <WebAccountPanelPopoverBase {...props} />
  );
}
