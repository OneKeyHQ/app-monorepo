import React, { useCallback, useMemo, useState } from 'react';

import { Box, useUserDevice } from '@onekeyhq/components';

import AccountSelectorDesktop from './AccountSelectorDesktop';
import AccountSelectorMobile from './AccountSelectorMobile';
import AccountSelectorTrigger from './AccountSelectorTrigger';

const AccountSelector = () => {
  const [visible, setVisible] = useState(false);
  const { size } = useUserDevice();
  const handleToggleVisible = useCallback(() => {
    setVisible((v) => !v);
  }, []);

  const child = useMemo(() => {
    if (['SMALL', 'NORMAL'].includes(size)) {
      return (
        <AccountSelectorMobile
          visible={visible}
          handleToggleVisible={handleToggleVisible}
        />
      );
    }
    return <AccountSelectorDesktop visible={visible} />;
  }, [visible, handleToggleVisible, size]);

  return (
    <Box
      width="100%"
      position="relative"
      maxW="260px"
      justifyContent="center"
      alignSelf="center"
    >
      <AccountSelectorTrigger
        visible={visible}
        handleToggleVisible={handleToggleVisible}
      />
      {child}
    </Box>
  );
};

export default AccountSelector;
