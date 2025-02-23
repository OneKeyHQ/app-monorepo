import * as React from 'react';

import { IconButton } from '@onekeyhq/components';

const CloseButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <IconButton
    variant="primary"
    position="absolute"
    top="0"
    right="0"
    icon="CrossedSmallOutline"
    onPress={onClick}
    aria-label="Close"
  />
);

export default CloseButton;
