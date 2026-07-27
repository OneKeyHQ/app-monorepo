import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  DebugRenderTracker,
  IconButton,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components/src/actions/IconButton';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useShowGuide } from '../hooks/useShowGuide';

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
  showGuideEntry = false,
  ...rest
}: IPerpSettingsButtonProps & {
  showActivityCenterEntry?: boolean;
  showGuideEntry?: boolean;
}) {
  const intl = useIntl();
  const { gtXl } = useMedia();
  const { showGuide } = useShowGuide({ forceModal: !gtXl });
  const [isActivityCenterOpen, setIsActivityCenterOpen] = useState(false);
  const handleOpenActivityCenter = useCallback(() => {
    setIsActivityCenterOpen(true);
  }, []);
  const handleOpenDialog = useCallback(() => {
    showPerpSettingsDialog({
      title: intl.formatMessage({
        id: ETranslations.address_book_menu_title,
      }),
      onOpenActivityCenter: handleOpenActivityCenter,
      onOpenGuide: showGuide,
      showActivityCenterEntry,
      showGuideEntry,
    });
  }, [
    handleOpenActivityCenter,
    intl,
    showActivityCenterEntry,
    showGuide,
    showGuideEntry,
  ]);

  if (!gtXl) {
    return (
      <DebugRenderTracker name="PerpSettingsButton">
        <>
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
      showGuideEntry={showGuideEntry}
      renderTrigger={
        <IconButton
          testID="perp-content-icon-btn"
          icon="DotHorOutline"
          size={size}
          variant={variant}
          iconColor="$iconSubdued"
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
