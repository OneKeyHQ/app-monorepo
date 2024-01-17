import { memo } from 'react';

import { ActionList, IconButton } from '@onekeyhq/components';

import { ESwapReceiveAddressType } from '../types';

interface ISwapReceiverAddressTypeTriggerProps {
  onSelectType: (type: ESwapReceiveAddressType) => void;
}
const SwapReceiverAddressTypeTrigger = ({
  onSelectType,
}: ISwapReceiverAddressTypeTriggerProps) => {
  const types = [
    {
      label: 'user account',
      onPress: () => {
        onSelectType(ESwapReceiveAddressType.USER_ACCOUNT);
      },
    },
    {
      label: 'address book',
      onPress: () => {
        onSelectType(ESwapReceiveAddressType.ADDRESS_BOOK);
      },
    },
    {
      label: 'input',
      onPress: () => {
        onSelectType(ESwapReceiveAddressType.INPUT);
      },
    },
  ];
  return (
    <ActionList
      title=""
      renderTrigger={<IconButton icon="MoreIllus" />}
      items={types}
    />
  );
};

export default memo(SwapReceiverAddressTypeTrigger);
