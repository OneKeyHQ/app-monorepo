import React, { FC } from 'react';

import { Box, PresenceTransition } from '@onekeyhq/components';

import AccountSelectorChildren from './AccountSelectorChildren';

type ChildDropdownProps = {
  visible: boolean;
  handleToggleVisible: () => void;
};

const AccountSelectorDesktop: FC<ChildDropdownProps> = ({
  visible,
  handleToggleVisible,
}) => (
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
      <AccountSelectorChildren handleToggleVisible={handleToggleVisible} />
    </Box>
  </PresenceTransition>
);

export default AccountSelectorDesktop;
