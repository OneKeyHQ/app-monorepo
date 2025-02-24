import * as React from 'react';

import { IconButton } from '@onekeyhq/components';

const CloseButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
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
    }}
  />
);

export default CloseButton;
