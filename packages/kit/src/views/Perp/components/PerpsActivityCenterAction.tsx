import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  IconButton,
  Stack,
  XStack,
  YStack,
  useDialogInstance,
  useMedia,
} from '@onekeyhq/components';
import {
  ActivityHubAction,
  ActivityHubContent,
  shouldShowActivityHubInvitePanel,
  useShowActivityHub,
} from '@onekeyhq/kit/src/components/ActivityHub';
import type { IActivityHubDetailEntry } from '@onekeyhq/kit/src/components/ActivityHub/types';
import { useOpenReferralPage } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { usePerpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { usePerpsRecallBannerVisibility } from '../hooks/usePerpsRecallBannerVisibility';
import { usePerpsRecallProgress } from '../hooks/usePerpsRecallProgress';

import { PerpsCampaignIllustration } from './PerpsCampaignIllustration';
import {
  PerpsRecallDialogContent,
  showPerpsRecallDialog,
} from './PerpsRecallDialog';
import { PerpsRecallIllustration } from './PerpsRecallIllustration';

function usePerpsActivityHubProps() {
  const { progress, instanceId, refresh } = usePerpsRecallProgress();
  const { isBannerHidden, setBannerHidden } = usePerpsRecallBannerVisibility({
    instanceId,
    activityId: progress?.activityId,
  });
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const campaigns = useMemo(
    () => perpConfigCommon?.activityCards ?? [],
    [perpConfigCommon?.activityCards],
  );

  const handleOpenReferral = useOpenReferralPage();

  const detailEntry: IActivityHubDetailEntry | undefined = progress
    ? {
        id: progress.activityId,
        title: 'Comeback rewards',
        subtitle: 'View your rewards and trading progress',
        icon: 'GiftOutline',
        illustration: <PerpsRecallIllustration trimmed />,
        onOpen: () => {
          showPerpsRecallDialog({
            activityId: progress.activityId,
            instanceId,
          });
        },
      }
    : undefined;

  return {
    campaigns,
    handleOpenReferral,
    refresh,
    detailEntry,
    instanceId,
    isBannerHidden,
    setBannerHidden,
  };
}

export function PerpsActivityCenterContent({
  closePopover,
  showTitle = true,
  menuLayout = false,
  menuPopoverLayout = false,
  menuShortcuts,
  renderMenuReferral,
}: {
  closePopover: () => void;
  showTitle?: boolean;
  menuLayout?: boolean;
  menuPopoverLayout?: boolean;
  menuShortcuts?: ReactNode;
  renderMenuReferral?: (referral: ReactNode) => ReactNode;
}) {
  const {
    campaigns,
    handleOpenReferral,
    detailEntry,
    isBannerHidden,
    setBannerHidden,
  } = usePerpsActivityHubProps();
  const showActivityHub = useShowActivityHub();
  // The menu already lists the campaigns, so the dialog holds only the
  // invite panel.
  const openInvitePanel = useCallback(() => {
    showActivityHub({ source: 'Perps', onOpenReferral: handleOpenReferral });
  }, [handleOpenReferral, showActivityHub]);

  return (
    <>
      <ActivityHubContent
        source="Perps"
        closePopover={closePopover}
        showTitle={showTitle}
        menuLayout={menuLayout}
        menuPopoverLayout={menuPopoverLayout}
        menuShortcuts={menuShortcuts}
        renderMenuReferral={renderMenuReferral}
        campaignFallbackIllustration={
          menuLayout ? <PerpsCampaignIllustration trimmed /> : undefined
        }
        onOpenReferral={handleOpenReferral}
        onOpenInvitePanel={
          menuLayout && shouldShowActivityHubInvitePanel()
            ? openInvitePanel
            : undefined
        }
        campaigns={campaigns}
        detailEntry={detailEntry}
      />
      {menuLayout && isBannerHidden ? (
        <YStack px="$5" pb="$3">
          <Button
            testID="perps-recall-restore-banner"
            variant="tertiary"
            size="small"
            onPress={() => {
              setBannerHidden(false);
              closePopover();
            }}
          >
            Restore reward banner
          </Button>
        </YStack>
      ) : null}
    </>
  );
}

function PerpsActivityCenterDialogContent({
  initialDetailId,
}: {
  initialDetailId?: string;
}) {
  const intl = useIntl();
  const { close } = useDialogInstance();
  const { campaigns, handleOpenReferral, detailEntry, instanceId } =
    usePerpsActivityHubProps();
  const [selected, setSelected] = useState(() =>
    initialDetailId ? { activityId: initialDetailId, instanceId } : undefined,
  );
  const title = intl.formatMessage({ id: ETranslations.perps_activity_hub });
  return (
    <>
      <Dialog.Header>
        <XStack alignItems="center" gap="$3">
          {selected ? (
            <IconButton
              testID="perps-activity-dialog-back"
              icon="ArrowLeftOutline"
              size="small"
              variant="tertiary"
              accessibilityLabel="Back to activity center"
              onPress={() => setSelected(undefined)}
            />
          ) : null}
          <Dialog.Title flexShrink={1}>
            {selected ? 'Comeback rewards' : title}
          </Dialog.Title>
        </XStack>
      </Dialog.Header>
      {selected ? (
        <YStack px="$5" pb="$5">
          <PerpsRecallDialogContent {...selected} />
        </YStack>
      ) : (
        <ActivityHubContent
          source="Perps"
          showTitle={false}
          closePopover={close}
          onOpenReferral={handleOpenReferral}
          campaigns={campaigns}
          detailEntry={
            detailEntry
              ? {
                  ...detailEntry,
                  onOpen: () =>
                    setSelected({ activityId: detailEntry.id, instanceId }),
                  closeOnOpen: false,
                }
              : undefined
          }
        />
      )}
    </>
  );
}

export function showPerpsActivityCenterDialog({
  initialDetailId,
  onClose,
}: {
  initialDetailId?: string;
  onClose?: () => void;
} = {}) {
  return Dialog.show({
    showFooter: false,
    contentContainerProps: { p: '$0' },
    renderContent: (
      <PerpsActivityCenterDialogContent initialDetailId={initialDetailId} />
    ),
    onClose,
  });
}

type IPerpsActivityCenterActionProps = {
  size?: IButtonProps['size'];
  renderTrigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function MobileActivityCenterAction({
  size,
  renderTrigger,
  open,
  onOpenChange,
}: IPerpsActivityCenterActionProps) {
  const intl = useIntl();
  const dialogRef = useRef<ReturnType<typeof Dialog.show> | undefined>(
    undefined,
  );
  const handleOpen = useCallback(() => {
    if (dialogRef.current) return;
    dialogRef.current = showPerpsActivityCenterDialog({
      onClose: () => {
        dialogRef.current = undefined;
        onOpenChange?.(false);
      },
    });
    onOpenChange?.(true);
  }, [onOpenChange]);
  useEffect(() => {
    if (open === true) handleOpen();
    else if (open === false) void dialogRef.current?.close();
  }, [open, handleOpen]);
  useEffect(
    () => () => {
      void dialogRef.current?.close();
    },
    [],
  );
  if (
    isValidElement<IButtonProps>(renderTrigger) &&
    typeof renderTrigger.type !== 'string'
  ) {
    return cloneElement(renderTrigger, { onPress: handleOpen });
  }
  if (renderTrigger) {
    return <Stack onPress={handleOpen}>{renderTrigger}</Stack>;
  }
  return (
    <IconButton
      testID="perps-activity-center-dialog-trigger"
      icon="GiftOutline"
      size={size}
      title={intl.formatMessage({ id: ETranslations.perps_activity_hub })}
      onPress={handleOpen}
    />
  );
}

function DesktopActivityCenterAction({
  size = 'medium',
  renderTrigger,
  open,
  onOpenChange,
}: IPerpsActivityCenterActionProps) {
  const { campaigns, handleOpenReferral, detailEntry, refresh } =
    usePerpsActivityHubProps();
  return (
    <ActivityHubAction
      source="Perps"
      size={size}
      renderTrigger={renderTrigger}
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) void refresh();
        onOpenChange?.(nextOpen);
      }}
      onOpenReferral={handleOpenReferral}
      campaigns={campaigns}
      detailEntry={detailEntry}
    />
  );
}

export function PerpsActivityCenterAction(
  props: IPerpsActivityCenterActionProps,
) {
  const { gtMd } = useMedia();
  return platformEnv.isNative || !gtMd ? (
    <MobileActivityCenterAction {...props} />
  ) : (
    <DesktopActivityCenterAction {...props} />
  );
}
