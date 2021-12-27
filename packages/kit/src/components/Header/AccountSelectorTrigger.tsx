import React, { FC } from 'react';

import { Account, Icon, Pressable, useUserDevice } from '@onekeyhq/components';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';

type Props = {
  visible: boolean;
  handleToggleVisible: () => void;
};

const AccountSelectorTrigger: FC<Props> = ({
  visible,
  handleToggleVisible,
}) => {
  const { address, label } = useAppSelector((s) => s.account);
  const { size } = useUserDevice();
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(size);
  return (
    <Pressable
      mx="1"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      borderRadius="12px"
      bg={visible ? 'surface-selected' : 'transparent'}
      p="1"
      onPress={handleToggleVisible}
    >
      <Account address={address} name={isSmallScreen ? '' : label} />
      <Icon name="SelectorOutline" />
    </Pressable>
  );
};

export default AccountSelectorTrigger;
