import { DebugRenderTracker, IconButton } from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components/src/actions/IconButton';

import { PerpSettingsPopover } from './PerpSettingsDialog';

type IPerpSettingsButtonProps = Omit<IIconButtonProps, 'icon' | 'onPress'>;

export function PerpSettingsButton({
  size = 'small',
  variant = 'tertiary',
  ...rest
}: IPerpSettingsButtonProps) {
  const content = (
    <PerpSettingsPopover
      renderTrigger={
        <IconButton
          icon="DotHorOutline"
          size={size}
          variant={variant}
          iconColor="$iconSubdued"
          cursor="pointer"
          {...rest}
        />
      }
    />
  );
  return (
    <DebugRenderTracker name="PerpSettingsButton">{content}</DebugRenderTracker>
  );
}
