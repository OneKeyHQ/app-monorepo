import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Dialog,
  IconButton,
  Stack,
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
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOpenReferralPage } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { usePerpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { usePerpsRecallBannerVisibility } from '../hooks/usePerpsRecallBannerVisibility';
import { usePerpsRecallEntry } from '../hooks/usePerpsRecallEntry';
import { usePerpsRecallProgress } from '../hooks/usePerpsRecallProgress';

import { PerpsCampaignIllustration } from './PerpsCampaignIllustration';
import { showPerpsRecallDialog } from './PerpsRecallDialog';
import { PerpsRecallIllustration } from './PerpsRecallIllustration';

type IActivityCenterSource = 'activityHub' | 'perpsMenu';

function usePerpsActivityHubProps(
  entrySource: IActivityCenterSource = 'activityHub',
) {
  const intl = useIntl();
  const { progress, instanceId, refresh } = usePerpsRecallProgress();
  const { isBannerHidden, setBannerHidden } = usePerpsRecallBannerVisibility({
    instanceId,
    progress,
  });
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const campaigns = useMemo(
    () => perpConfigCommon?.activityCards ?? [],
    [perpConfigCommon?.activityCards],
  );

  const handleOpenReferral = useOpenReferralPage();

  const tracking = usePerpsRecallEntry({ progress, instanceId, entrySource });
  const detailEntry: IActivityHubDetailEntry | undefined = progress
    ? {
        title: intl.formatMessage({ id: ETranslations.perps_recall__title }),
        subtitle: intl.formatMessage({
          id: ETranslations.perps_recall_progress__desc,
        }),
        icon: 'GiftOutline',
        illustration: <PerpsRecallIllustration trimmed />,
        impressionRef: tracking.impressionRef,
        onPress: tracking.trackClick,
        onOpen: () => {
          showPerpsRecallDialog({
            intl,
            activityId: progress.activityId,
            entrySource,
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
    isBannerHidden,
    setBannerHidden,
  };
}

export function PerpsActivityCenterContent({
  entrySource = 'activityHub',
  closePopover,
  showTitle = true,
  menuLayout = false,
  menuPopoverLayout = false,
  menuShortcuts,
  menuFooter,
  renderMenuReferral,
}: {
  entrySource?: IActivityCenterSource;
  closePopover: () => void;
  showTitle?: boolean;
  menuLayout?: boolean;
  menuPopoverLayout?: boolean;
  menuShortcuts?: ReactNode;
  menuFooter?: ReactNode;
  renderMenuReferral?: (referral: ReactNode) => ReactNode;
}) {
  const {
    campaigns,
    handleOpenReferral,
    detailEntry,
    isBannerHidden,
    setBannerHidden,
  } = usePerpsActivityHubProps(entrySource);
  const intl = useIntl();
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
      {menuFooter}
      {platformEnv.isDev && menuLayout && isBannerHidden ? (
        <YStack px="$2" pb="$3">
          <ListItem
            testID="perps-recall-restore-banner"
            mx="$0"
            px="$3"
            titleProps={{ size: '$bodyMdMedium' }}
            title={intl.formatMessage({
              id: ETranslations.perps_recall_restore_banner__action,
            })}
            onPress={() => {
              setBannerHidden(false);
              closePopover();
            }}
            cursor="default"
          />
        </YStack>
      ) : null}
    </>
  );
}

function PerpsActivityCenterDialogContent() {
  const intl = useIntl();
  const { close } = useDialogInstance();
  const { campaigns, handleOpenReferral, detailEntry } =
    usePerpsActivityHubProps();
  const title = intl.formatMessage({ id: ETranslations.perps_activity_hub });
  return (
    <>
      <Dialog.Header>
        <Dialog.Title>{title}</Dialog.Title>
      </Dialog.Header>
      <ActivityHubContent
        source="Perps"
        showTitle={false}
        closePopover={close}
        onOpenReferral={handleOpenReferral}
        campaigns={campaigns}
        detailEntry={detailEntry}
      />
    </>
  );
}

function showPerpsActivityCenterDialog({
  onClose,
}: {
  onClose?: () => void;
} = {}) {
  return Dialog.show({
    showFooter: false,
    contentContainerProps: { p: '$0' },
    renderContent: <PerpsActivityCenterDialogContent />,
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
