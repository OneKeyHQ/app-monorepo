import React, { useCallback, useMemo, useState } from 'react';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';

import AccountSelectorDesktop from './AccountSelectorDesktop';
import AccountSelectorMobile from './AccountSelectorMobile';
import AccountSelectorTrigger from './AccountSelectorTrigger';

const AccountSelector = () => {
  const [visible, setVisible] = useState(false);
  const isVerticalLayout = useIsVerticalLayout();
  const handleToggleVisible = useCallback(() => {
    setVisible((v) => !v);
  }, []);

  const child = useMemo(() => {
    if (isVerticalLayout) {
      return (
        <AccountSelectorMobile
          visible={visible}
          handleToggleVisible={handleToggleVisible}
        />
      );
    }
    return (
      <AccountSelectorDesktop
        visible={visible}
        handleToggleVisible={handleToggleVisible}
      />
    );
  }, [visible, handleToggleVisible, isVerticalLayout]);

  return (
    <Box position="relative" w={{ md: 'full' }}>
      <AccountSelectorTrigger
        visible={visible}
        handleToggleVisible={handleToggleVisible}
      />
      {child}
    </Box>
  );
};

export default AccountSelector;
