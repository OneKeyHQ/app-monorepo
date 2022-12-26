import type { FC } from 'react';
import { useMemo } from 'react';

import type { ICON_NAMES } from '@onekeyhq/components';
import { useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
import { gotoScanQrcode } from '../../utils/gotoScanQrcode';

import BaseMenu from './BaseMenu';

import type { IMenu } from './BaseMenu';
import type { MessageDescriptor } from 'react-intl';

const HomeMoreMenu: FC<IMenu> = (props) => {
  const isPasswordSet = useAppSelector((s) => s.data.isPasswordSet);
  const isVerticalLayout = useIsVerticalLayout();
  const options: (
    | {
        id: MessageDescriptor['id'];
        onPress: () => void;
        icon: ICON_NAMES;
      }
    | false
    | undefined
  )[] = useMemo(
    () => [
      {
        id: 'action__scan',
        onPress: () => gotoScanQrcode(),
        icon: isVerticalLayout
          ? 'ViewfinderCircleOutline'
          : 'ViewfinderCircleMini',
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
        icon: isVerticalLayout ? 'LockClosedOutline' : 'LockClosedMini',
      },
    ],
    [isVerticalLayout, isPasswordSet],
  );

  return <BaseMenu options={options} {...props} />;
};

export default HomeMoreMenu;
