import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { Divider, IconButton } from '@onekeyhq/components';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import type {
  IBaseMenuOptions,
  IMenu,
} from '@onekeyhq/kit/src/views/Overlay/BaseMenu';

const AccountItemMenu: FC<
  IMenu & {
    onChange: (value: string) => void;
  }
> = ({ onChange, ...props }) => {
  const onPress = useCallback(
    (value: string) => {
      onChange?.(value);
    },
    [onChange],
  );

  const options = useMemo<IBaseMenuOptions>(
    () => [
      {
        id: 'action__copy_address',
        onPress: () => onPress('copy'),
        icon: 'Square2StackOutline',
      },
      {
        id: 'action__rename',
        onPress: () => onPress('rename'),
        icon: 'TagOutline',
      },
      () => <Divider my={1} />,
    ],
    [onPress],
  );

  return <BaseMenu options={options} {...props} />;
};

function AllNetworksAccountItemSelectDropdown({
  accountId,
  walletId,
}: {
  accountId: string;
  walletId: string;
}) {
  const handleChange = useCallback((value: string) => {
    switch (value) {
      case 'detail':
        console.log('detail');
        break;
      default:
        console.log('detail');
        break;
    }
  }, []);

  return (
    <AccountItemMenu onChange={handleChange}>
      <IconButton name="EllipsisVerticalMini" type="plain" circle hitSlop={8} />
    </AccountItemMenu>
  );
}

export { AllNetworksAccountItemSelectDropdown };
