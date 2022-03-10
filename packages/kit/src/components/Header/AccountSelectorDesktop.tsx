import React, { FC } from 'react';

import { Box, PresenceTransition } from '@onekeyhq/components';
import useClickDocumentClose from '@onekeyhq/components/src/hooks/useClickDocumentClose';

import AccountSelectorChildren from './AccountSelectorChildren';

type ChildDropdownProps = {
  visible: boolean;
  toggleVisible?: (...args: any) => any;
};

const AccountSelectorDesktop: FC<ChildDropdownProps> = ({
  visible,
  toggleVisible,
}) => {
  const { domId } = useClickDocumentClose({
    name: 'AccountSelectorDesktop',
    visible,
    toggleVisible,
  });
  return (
    <PresenceTransition
      visible={visible}
      initial={{ opacity: 0, translateY: 0 }}
      animate={{
        opacity: 1,
        translateY: 8,
        transition: {
          duration: 150,
        },
      }}
    >
      <Box
        nativeID={domId}
        zIndex={999}
        position="absolute"
        width="320px"
        height="564px"
        borderRadius="xl"
        bg="surface-subdued"
        borderColor="border-subdued"
        borderWidth="1px"
        flexDirection="row"
        shadow="depth.3"
      >
        <AccountSelectorChildren />
      </Box>
    </PresenceTransition>
  );
};

export default AccountSelectorDesktop;
