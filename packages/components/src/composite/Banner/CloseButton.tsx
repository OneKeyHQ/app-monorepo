import * as React from 'react';
import { useCallback } from 'react';

import { IconButton, Toast } from '@onekeyhq/components';

const CloseButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const handlePress = useCallback(() => {
    onPress();
    Toast.success({
      title: 'Action was successful!',
    });
  }, [onPress]);

  return (
    <IconButton
      size="small"
      variant="tertiary"
      position="absolute"
      top="$2"
      right="$2"
      icon="CrossedSmallOutline"
      onPress={handlePress}
      aria-label="Close"
      iconProps={{
        color: '$whiteA10',
      }}
    />
  );
};

export default CloseButton;
