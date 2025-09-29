import { useCallback } from 'react';

import { IconButton } from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components/src/actions/IconButton';

import { showPerpSettingsDialog } from './PerpSettingsDialog';

type IPerpSettingsButtonProps = Omit<IIconButtonProps, 'icon' | 'onPress'>;

export function PerpSettingsButton({
  size = 'small',
  variant = 'tertiary',
  ...rest
}: IPerpSettingsButtonProps) {
  const handlePress = useCallback(() => {
    showPerpSettingsDialog();
  }, []);

  return (
    <IconButton
      icon="SettingsOutline"
      size={size}
      variant={variant}
      iconColor="$iconSubdued"
      onPress={handlePress}
      {...rest}
    />
  );
}
