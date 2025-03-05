import * as React from 'react';

import { IconButton } from '@onekeyhq/components';

import { useHoverOpacity } from '../../hooks/useHoverOpacity';

const CloseButton: React.FC<{ onPress: () => void; isHovering?: boolean }> = ({
  onPress,
  isHovering,
}) => {
  const hoverOpacity = useHoverOpacity(isHovering);

  return (
    <IconButton
      size="small"
      variant="tertiary"
      position="absolute"
      top="$2"
      right="$2"
      icon="CrossedSmallOutline"
      onPress={onPress}
      aria-label="Close"
      iconProps={{
        color: '$whiteA10',
        ...hoverOpacity,
      }}
    />
  );
};

export default CloseButton;
