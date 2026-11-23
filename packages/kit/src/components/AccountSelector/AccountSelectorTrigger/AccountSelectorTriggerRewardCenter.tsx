import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { RefObject } from 'react';

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

// The content of one opening of the popover. What it starts can outlive it:
// creating an address goes on after the popover was dismissed, and its
// completion asks to close. By then another opening may be on screen, which
// that request must leave alone.
function RewardPopoverContent({
  opening,
  currentOpeningRef,
  closePopover,
  num,
  linkNetworkId,
}: {
  opening: number;
  currentOpeningRef: RefObject<number>;
  closePopover: () => void;
  num: number;
  linkNetworkId?: string;
}) {
  const closeThisOpening = useCallback(() => {
    if (currentOpeningRef.current === opening) {
      closePopover();
    }
  }, [closePopover, currentOpeningRef, opening]);
  return (
    <LazyPopoverContent
      num={num}
      linkNetworkId={linkNetworkId}
      closePopover={closeThisOpening}
    />
  );
}

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
  // Numbers the openings, so a close can be told apart by the opening it
  // was handed to.
  const [opening, setOpening] = useState(0);
  const currentOpeningRef = useRef(opening);
  currentOpeningRef.current = opening;
  const isOpenRef = useRef(false);
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen && !isOpenRef.current) {
      setOpening((value) => value + 1);
    }
    isOpenRef.current = nextOpen;
    setOpen(nextOpen);
  }, []);
  const usePopover = Boolean(
    compact && media.gtMd && (platformEnv.isDesktop || platformEnv.isWeb),
  );
  useEffect(() => {
    if (!usePopover) {
      handleOpenChange(false);
    }
  }, [usePopover, handleOpenChange]);
  const openPopover = useCallback(
    () => handleOpenChange(true),
    [handleOpenChange],
  );
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
            <RewardPopoverContent
              opening={opening}
              currentOpeningRef={currentOpeningRef}
              num={num}
              linkNetworkId={linkNetworkId}
              closePopover={closePopover}
            />
          </Suspense>
        </AccountSelectorProviderMirror>
      ) : null,
    [config, linkNetworkId, num, opening],
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
      onOpenChange={handleOpenChange}
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
