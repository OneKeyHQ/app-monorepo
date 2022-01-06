import React, { FC } from 'react';

import {
  Account,
  HStack,
  Icon,
  Pressable,
  useUserDevice,
} from '@onekeyhq/components';
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
    <Pressable onPress={handleToggleVisible}>
      {({ isHovered }) => (
        <HStack
          p="2"
          alignItems="center"
          justifyContent="space-between"
          borderRadius="12px"
          space={1}
          bg={
            // eslint-disable-next-line no-nested-ternary
            visible
              ? 'surface-selected'
              : isHovered
              ? 'surface-hovered'
              : 'transparent'
          }
        >
          <Account address={address} name={isSmallScreen ? undefined : label} />
          <Icon size={20} name="SelectorSolid" />
        </HStack>
      )}
    </Pressable>
  );
};

export default AccountSelectorTrigger;
