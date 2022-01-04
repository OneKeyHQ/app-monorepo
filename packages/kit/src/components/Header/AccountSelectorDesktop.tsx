import React, { FC } from 'react';

import { Box } from '@onekeyhq/components';

import AccountSelectorChildren from './AccountSelectorChildren';

type ChildDropdownProps = {
  visible: boolean;
  handleToggleVisible: () => void;
};

const AccountSelectorDesktop: FC<ChildDropdownProps> = ({
  visible,
  handleToggleVisible,
}) => {
  if (!visible) return null;

  return (
    <Box
      zIndex={999}
      position="absolute"
      top="72px"
      width="320px"
      left="16px"
      height="564px"
      borderRadius="12px"
      bg="surface-subdued"
      borderColor="border-subdued"
      borderWidth="1px"
      flexDirection="row"
    >
      <AccountSelectorChildren handleToggleVisible={handleToggleVisible} />
    </Box>
  );
};

export default AccountSelectorDesktop;
