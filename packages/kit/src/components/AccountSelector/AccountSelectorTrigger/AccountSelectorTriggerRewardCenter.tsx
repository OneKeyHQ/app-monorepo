import { Suspense, lazy, useCallback, useEffect, useState } from 'react';

import { Popover, Spinner, YStack, useMedia } from '@onekeyhq/components';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { AccountSelectorProviderMirror } from '../AccountSelectorProvider';

import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

const LazyPopoverContent = lazy(
  () => import('./AccountSelectorRewardPopoverContent'),
);

const floatingPanelProps = {
  width: 320,
  maxWidth: '100%',
  p: 0,
  overflow: 'hidden',
  trapFocus: true,
} as const;

export function AccountSelectorTriggerRewardCenter({
  num,
  linkNetworkId,
  compact,
}: {
  num: number;
  linkNetworkId?: string;
  compact?: boolean;
}) {
  const media = useMedia();
  const { config } = useAccountSelectorContextData();
  const [open, setOpen] = useState(false);
  const usePopover = Boolean(
    compact && media.gtMd && (platformEnv.isDesktop || platformEnv.isWeb),
  );
  useEffect(() => {
    if (!usePopover) {
      setOpen(false);
    }
  }, [usePopover]);
  const openPopover = useCallback(() => setOpen(true), []);
  const renderContent = useCallback(
    ({ closePopover }: { closePopover: () => void }) =>
      config ? (
        <AccountSelectorProviderMirror config={config} enabledNum={[num]}>
          <Suspense
            fallback={
              <YStack height={200} alignItems="center" justifyContent="center">
                <Spinner />
              </YStack>
            }
          >
            <LazyPopoverContent
              num={num}
              linkNetworkId={linkNetworkId}
              closePopover={closePopover}
            />
          </Suspense>
        </AccountSelectorProviderMirror>
      ) : null,
    [config, linkNetworkId, num],
  );

  const trigger = (
    <AccountSelectorTriggerBase
      horizontalLayout
      compact={compact}
      showChevron={!compact}
      autoWidthForHome
      num={num}
      linkNetworkId={linkNetworkId}
      showWalletName={media.gtMd && !compact}
      onPress={usePopover ? openPopover : undefined}
    />
  );

  return usePopover ? (
    <Popover
      title=""
      showHeader={false}
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      offset={8}
      floatingPanelProps={floatingPanelProps}
      renderTrigger={trigger}
      renderContent={renderContent}
    />
  ) : (
    trigger
  );
}
