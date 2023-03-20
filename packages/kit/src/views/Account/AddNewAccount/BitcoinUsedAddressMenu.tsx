import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { CheckBox, Divider } from '@onekeyhq/components';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import type {
  IBaseMenuOptions,
  IMenu,
} from '@onekeyhq/kit/src/views/Overlay/BaseMenu';

import showFindAddressByPathBottomSheetModal from './FindAddressByPathBottomSheetModal';

const BitcoinUsedAddressMenu: FC<
  IMenu & {
    showPath: boolean;
    onChange: (isChecked: boolean) => void;
    walletId: string;
    networkId: string;
    accountId: string;
  }
> = (props) => {
  const { showPath, onChange, walletId, networkId, accountId } = props;

  const onPressShowPath = useCallback(() => {
    onChange?.(!showPath);
  }, [onChange, showPath]);

  const onPressFindAddressByPath = useCallback(() => {
    showFindAddressByPathBottomSheetModal({
      walletId,
      networkId,
      accountId,
      onConfirm: () => {
        console.log('confirm');
      },
    });
  }, [walletId, networkId, accountId]);

  const showPathCheckBox = useMemo(
    () => (
      <CheckBox
        w="20px"
        isChecked={showPath}
        isDisabled={false}
        onChange={onPressShowPath}
        pointerEvents="box-only"
      />
    ),
    [showPath, onPressShowPath],
  );

  const options = useMemo<IBaseMenuOptions>(
    () => [
      {
        id: 'action__find_address_by_path',
        onPress: onPressFindAddressByPath,
        icon: 'MagnifyingGlassMini',
      },
      () => <Divider my={1} />,
      {
        id: 'action__show_path',
        onPress: onPressShowPath,
        extraChildren: showPathCheckBox,
      },
    ],
    [onPressShowPath, showPathCheckBox, onPressFindAddressByPath],
  );

  return <BaseMenu options={options} {...props} menuWidth={261} />;
};

export default BitcoinUsedAddressMenu;
