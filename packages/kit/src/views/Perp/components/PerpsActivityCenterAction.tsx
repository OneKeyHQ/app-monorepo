import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps, IScrollViewRef } from '@onekeyhq/components';
import {
  Dialog,
  IconButton,
  YStack,
  useDialogInstance,
  useScrollView,
} from '@onekeyhq/components';
import {
  ActivityHubContent,
  shouldShowActivityHubInvitePanel,
  useShowActivityHub,
} from '@onekeyhq/kit/src/components/ActivityHub';
import type { IActivityHubOpenReferral } from '@onekeyhq/kit/src/components/ActivityHub';
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

function usePerpsActivityCampaigns() {
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  return useMemo(
    () => perpConfigCommon?.activityCards ?? [],
    [perpConfigCommon?.activityCards],
  );
}

// The shared header loads this only for Perps, and the opener outlives the menu.
export function PerpsReferralEntry({
  children,
}: {
  children: (openReferralPage: IActivityHubOpenReferral) => ReactNode;
}) {
  const openReferralPage = useOpenReferralPage();
  const openReferralPageRef = useRef(openReferralPage);
  openReferralPageRef.current = openReferralPage;
  // RawPopover uses the content callback as a component type. Theme changes
  // must update the opener without remounting the account panel's subpage.
  const handleOpenReferral = useCallback<IActivityHubOpenReferral>(
    (...args) => openReferralPageRef.current(...args),
    [],
  );
  return children(handleOpenReferral);
}

function usePerpsActivityHubProps(
  entrySource: IActivityCenterSource = 'activityHub',
  viewportRef?: RefObject<IScrollViewRef | null>,
) {
  const intl = useIntl();
  const { progress, instanceId, hasEnded } = usePerpsRecallProgress();
  const { isBannerHidden, setBannerHidden } = usePerpsRecallBannerVisibility({
    instanceId,
    progress,
  });
  const campaigns = usePerpsActivityCampaigns();

  const tracking = usePerpsRecallEntry({
    progress,
    instanceId,
    entrySource,
    viewportRef,
  });
  const detailEntry: IActivityHubDetailEntry | undefined = progress
    ? {
        title: intl.formatMessage({ id: ETranslations.perps_recall__title }),
        isEnded: hasEnded || progress.payoutStatus !== 'pending',
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
  onOpenReferral,
}: {
  entrySource?: IActivityCenterSource;
  closePopover: () => void;
  showTitle?: boolean;
  menuLayout?: boolean;
  menuPopoverLayout?: boolean;
  menuShortcuts?: ReactNode;
  menuFooter?: ReactNode;
  renderMenuReferral?: (referral: ReactNode) => ReactNode;
  // The opener must outlive the menu, which closes before referral navigation.
  onOpenReferral: IActivityHubOpenReferral;
}) {
  const { scrollViewRef } = useScrollView();
  const { campaigns, detailEntry, isBannerHidden, setBannerHidden } =
    usePerpsActivityHubProps(
      entrySource,
      entrySource === 'perpsMenu' && platformEnv.isNative
        ? scrollViewRef
        : undefined,
    );
  const intl = useIntl();
  const showActivityHub = useShowActivityHub();
  // The menu already lists the campaigns, so the dialog holds only the
  // invite panel.
  const openInvitePanel = useCallback(() => {
    showActivityHub({ source: 'Perps', onOpenReferral });
  }, [onOpenReferral, showActivityHub]);

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
        onOpenReferral={onOpenReferral}
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

function PerpsActivityCenterDialogContent({
  onOpenReferral,
}: {
  onOpenReferral: IActivityHubOpenReferral;
}) {
  const intl = useIntl();
  const { close } = useDialogInstance();
  const { campaigns, detailEntry } = usePerpsActivityHubProps();
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
        onOpenReferral={onOpenReferral}
        campaigns={campaigns}
        detailEntry={detailEntry}
      />
    </>
  );
}

// The Perps page renders this button only in the narrow web toolbar.
export function PerpsActivityCenterAction({
  size,
}: {
  size?: IButtonProps['size'];
}) {
  const intl = useIntl();
  const handleOpenReferral = useOpenReferralPage();
  const dialogRef = useRef<ReturnType<typeof Dialog.show> | undefined>(
    undefined,
  );
  const handleOpen = useCallback(() => {
    if (dialogRef.current) return;
    dialogRef.current = Dialog.show({
      showFooter: false,
      contentContainerProps: { p: '$0' },
      renderContent: (
        <PerpsActivityCenterDialogContent onOpenReferral={handleOpenReferral} />
      ),
      onClose: () => {
        dialogRef.current = undefined;
      },
    });
  }, [handleOpenReferral]);
  useEffect(
    () => () => {
      void dialogRef.current?.close();
    },
    [],
  );
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
