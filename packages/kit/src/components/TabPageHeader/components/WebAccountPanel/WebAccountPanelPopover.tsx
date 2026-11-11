import type { ReactNode } from 'react';
import { Suspense, lazy, useCallback } from 'react';

import { Popover } from '@onekeyhq/components';
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
};

function WebAccountPanelPopoverBase({
  renderTrigger,
  initialView = 'main',
  connected = true,
  onOpenPerpsReferral,
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
            <LazyWebAccountPanelPopoverContent
              initialView={initialView}
              connected={connected}
              closePopover={closePopover}
              onOpenPerpsReferral={onOpenPerpsReferral}
            />
          </Suspense>
        </AccountSelectorProviderMirror>
      ) : null,
    [config, initialView, connected, onOpenPerpsReferral],
  );
  return (
    <Popover
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

export function WebAccountPanelPopover({
  showPerpsActivityCenter = false,
  ...props
}: IWebAccountPanelPopoverProps) {
  return showPerpsActivityCenter ? (
    <Suspense fallback={props.renderTrigger}>
      <LazyPerpsReferralEntry>
        {(openReferralPage) => (
          <WebAccountPanelPopoverBase
            {...props}
            onOpenPerpsReferral={openReferralPage}
          />
        )}
      </LazyPerpsReferralEntry>
    </Suspense>
  ) : (
    <WebAccountPanelPopoverBase {...props} />
  );
}
