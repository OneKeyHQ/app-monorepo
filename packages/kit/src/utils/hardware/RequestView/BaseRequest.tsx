import { FC, useEffect, useState } from 'react';

import { Box, IconButton, OverlayContainer } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type BaseRequestViewProps = {
  children: React.ReactNode;
  onCancel?: () => void;
};
const BaseRequestView: FC<BaseRequestViewProps> = ({ onCancel, children }) => {
  const [showClose, setShowClose] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setShowClose(true);
    }, 30 * 1000);
  }, []);

  return (
    <OverlayContainer>
      <Box w="full" h="full" alignItems="center" bg="overlay">
        <Box px={6} w="full" maxW="374" top={platformEnv.isNativeIOS ? 16 : 10}>
          <Box
            w="full"
            mx="auto"
            p={4}
            pb={6}
            rounded="xl"
            bgColor="surface-default"
            borderWidth={1}
            borderColor="border-subdued"
            shadow="depth.4"
          >
            {children}

            {!!showClose && (
              <IconButton
                onPress={() => {
                  onCancel?.();
                }}
                position="absolute"
                top={2}
                right={2}
                size="lg"
                type="plain"
                name="CloseSolid"
              />
            )}
          </Box>
        </Box>
      </Box>
    </OverlayContainer>
  );
};

export default BaseRequestView;
