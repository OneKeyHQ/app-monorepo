import { DebugRenderTracker, IconButton } from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components/src/actions/IconButton';

import { PerpSettingsPopover } from './PerpSettingsDialog';

type IPerpSettingsButtonProps = Omit<IIconButtonProps, 'icon' | 'onPress'>;

export function PerpSettingsButton({
  size = 'small',
  variant = 'tertiary',
  showGuideEntry = false,
  ...rest
}: IPerpSettingsButtonProps & {
  showGuideEntry?: boolean;
}) {
  const content = (
    <PerpSettingsPopover
      showGuideEntry={showGuideEntry}
      renderTrigger={
        <IconButton
          testID="perp-content-icon-btn"
          icon="DotHorOutline"
          size={size}
          variant={variant}
          iconColor="$iconSubdued"
          cursor="default"
          {...rest}
        />
      }
    />
  );
  return (
    <DebugRenderTracker name="PerpSettingsButton">{content}</DebugRenderTracker>
  );
}
