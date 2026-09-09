import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  DebugRenderTracker,
  IconButton,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components/src/actions/IconButton';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import { useShowGuide } from '../hooks/useShowGuide';
import { PerpTestIDs } from '../testIDs';

import { PerpFeatureDot } from './PerpFeatureDot';
import { PerpsActivityCenterAction } from './PerpsActivityCenterAction';
import {
  PerpSettingsPopover,
  showPerpSettingsDialog,
} from './PerpSettingsDialog';

type IPerpSettingsButtonProps = Omit<IIconButtonProps, 'icon' | 'onPress'>;

export function PerpSettingsButton({
  size = 'small',
  variant = 'tertiary',
  showActivityCenterEntry = false,
  showChartPositionSetting = false,
  showGuideEntry = false,
  mr,
  ...rest
}: IPerpSettingsButtonProps & {
  showActivityCenterEntry?: boolean;
  showChartPositionSetting?: boolean;
  showGuideEntry?: boolean;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const isMobileLayout = platformEnv.isNative || !gtMd;
  const shouldShowChartPositionSetting =
    showChartPositionSetting || isMobileLayout;
  const {
    isFirstVisit: isSettingsFeatureFirstVisit,
    tourVisited: markSettingsFeatureVisited,
  } = useSpotlight(ESpotlightTour.perpLayoutSettingsMenu);
  const { showGuide } = useShowGuide({ forceModal: isMobileLayout });
  const [isActivityCenterOpen, setIsActivityCenterOpen] = useState(false);
  const handleOpenActivityCenter = useCallback(() => {
    setIsActivityCenterOpen(true);
  }, []);
  const handleOpenDialog = useCallback(() => {
    if (isMobileLayout && isSettingsFeatureFirstVisit) {
      void markSettingsFeatureVisited();
    }
    showPerpSettingsDialog({
      title: intl.formatMessage({
        id: ETranslations.address_book_menu_title,
      }),
      onOpenActivityCenter: handleOpenActivityCenter,
      onOpenGuide: showGuide,
      showActivityCenterEntry,
      showChartPositionSetting: shouldShowChartPositionSetting,
      showGuideEntry,
    });
  }, [
    handleOpenActivityCenter,
    intl,
    isMobileLayout,
    isSettingsFeatureFirstVisit,
    markSettingsFeatureVisited,
    showActivityCenterEntry,
    shouldShowChartPositionSetting,
    showGuide,
    showGuideEntry,
  ]);

  if (isMobileLayout) {
    return (
      <DebugRenderTracker name="PerpSettingsButton">
        <>
          <Stack
            position="relative"
            width="$5"
            height="$5"
            alignItems="center"
            justifyContent="center"
            mr={mr}
          >
            <IconButton
              testID="perp-content-icon-btn"
              icon="DotHorOutline"
              size={size}
              variant={variant}
              iconColor="$iconSubdued"
              onPress={handleOpenDialog}
              {...rest}
              cursor={platformEnv.isNative ? undefined : 'pointer'}
            />
            {isMobileLayout && isSettingsFeatureFirstVisit ? (
              <Stack
                position="absolute"
                top={-4}
                right={-4}
                borderRadius="$full"
                borderWidth="$0.5"
                borderColor="$bgApp"
                pointerEvents="none"
              >
                <PerpFeatureDot testID={PerpTestIDs.MobileSettingsFeatureDot} />
              </Stack>
            ) : null}
          </Stack>
          {showActivityCenterEntry ? (
            <PerpsActivityCenterAction
              copyAsUrl
              open={isActivityCenterOpen}
              onOpenChange={setIsActivityCenterOpen}
              renderTrigger={<Stack display="none" />}
            />
          ) : null}
        </>
      </DebugRenderTracker>
    );
  }

  const content = (
    <PerpSettingsPopover
      showActivityCenterEntry={showActivityCenterEntry}
      showChartPositionSetting={shouldShowChartPositionSetting}
      showGuideEntry={showGuideEntry}
      renderTrigger={
        <IconButton
          testID="perp-content-icon-btn"
          icon="DotHorOutline"
          size={size}
          variant={variant}
          iconColor="$iconSubdued"
          mr={mr}
          {...rest}
          cursor="pointer"
        />
      }
    />
  );
  return (
    <DebugRenderTracker name="PerpSettingsButton">{content}</DebugRenderTracker>
  );
}
