import * as React from 'react';

import { IconButton } from '@onekeyhq/components';

const CloseButton: React.FC<{ onPress: () => void; isHovering?: boolean }> = ({
  onPress,
  isHovering,
}) => (
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
      opacity: isHovering ? 1 : 0.7,
      animation: 'quick',
    }}
  />
);

export default CloseButton;
