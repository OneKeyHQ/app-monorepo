import type { FC } from 'react';
import { useMemo } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
import { selectIsPasswordSet } from '../../store/selectors';
import { gotoScanQrcode } from '../../utils/gotoScanQrcode';

import BaseMenu from './BaseMenu';
import useUpdateItem from './useUpdateItem';

import type { IBaseMenuOptions, IMenu } from './BaseMenu';

const HomeMoreMenu: FC<IMenu> = (props) => {
  const isPasswordSet = useAppSelector(selectIsPasswordSet);
  const updateItemOptions = useUpdateItem();
  const options = useMemo(() => {
    const baseOptions: IBaseMenuOptions = [
      {
        id: 'action__scan',
        onPress: () => gotoScanQrcode(),
        icon: 'ViewfinderCircleMini',
      },
      platformEnv.isExtensionUiPopup && {
        id: 'form__expand_view',
        onPress: () => {
          backgroundApiProxy.serviceApp.openExtensionExpandTab({
            routes: '',
          });
        },
        icon: 'ArrowsPointingOutOutline',
      },
      isPasswordSet && {
        id: 'action__lock_now',
        onPress: () => backgroundApiProxy.serviceApp.lock(true),
        icon: 'LockClosedMini',
      },
    ];
    return updateItemOptions
      ? baseOptions.concat(updateItemOptions)
      : baseOptions;
  }, [isPasswordSet, updateItemOptions]);

  return <BaseMenu options={options} {...props} />;
};

export default HomeMoreMenu;
