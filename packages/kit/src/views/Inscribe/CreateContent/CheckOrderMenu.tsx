import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';

import type { ICON_NAMES } from '@onekeyhq/components';

import { InscribeModalRoutes } from '../../../routes/routesEnum';
import BaseMenu from '../../Overlay/BaseMenu';

import type { InscribeModalRoutesParams } from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';
import type { IMenu } from '../../Overlay/BaseMenu';
import type { MessageDescriptor } from 'react-intl';

type NavigationProps = ModalScreenProps<InscribeModalRoutesParams>;

type Props = IMenu;
const CheckOrderMenu: FC<Props> = ({ ...props }) => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const checkOrder = useCallback(() => {
    navigation.navigate(InscribeModalRoutes.OrderList);
  }, [navigation]);

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
        id: 'action__check_orders',
        onPress: checkOrder,
        icon: 'ListBulletOutline',
      },
    ],
    [checkOrder],
  );
  return <BaseMenu w={190} options={options} {...props} />;
};

export default CheckOrderMenu;
