import type { FC } from 'react';
import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Box, useSafeAreaInsets } from '@onekeyhq/components';

import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../hooks';
import AssetsList from '../Wallet/AssetsList';

import type { HomeRoutes } from '../../routes/types';
import type { FullTokenListRoutesParams } from './routes';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type FullTokenListProps = NativeStackScreenProps<
  FullTokenListRoutesParams,
  HomeRoutes.FullTokenListScreen
>;

// type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.FullTokenListScreen>;

const FullTokenList: FC<FullTokenListProps> = () => {
  const navigation = useNavigation();
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const { accountId, networkId } = useActiveWalletAccount();
  useEffect(() => {
    const title = intl.formatMessage({ id: 'asset__tokens' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl]);
  const hideSmallBalance = useAppSelector((s) => s.settings.hideSmallBalance);

  return (
    <AssetsList
      hideSmallBalance={hideSmallBalance}
      accountId={accountId}
      networkId={networkId}
      flatStyle
      ListFooterComponent={<Box h={`${48 + bottom}px`} />}
    />
  );
};
export default FullTokenList;
