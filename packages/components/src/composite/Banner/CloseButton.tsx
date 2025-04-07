import * as React from 'react';

import { IconButton } from '../../actions/IconButton';
import { useHoverOpacity } from '../../hooks/useHoverOpacity';
import { Stack } from '../../primitives/Stack';

const CloseButton: React.FC<{ onPress: () => void; isHovering?: boolean }> = ({
  onPress,
  isHovering,
}) => {
  const hoverOpacity = useHoverOpacity(isHovering);

  return (
    <Stack position="absolute" top="$2" right="$2" {...hoverOpacity}>
      <IconButton
        size="small"
        variant="tertiary"
        icon="CrossedSmallOutline"
        onPress={onPress}
        aria-label="Close"
        testID="banner-close-button"
        iconProps={{
          color: '$whiteA10',
        }}
      />
    </Stack>
  );
};

export default CloseButton;
