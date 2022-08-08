import { FC, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { useNavigation } from '../../hooks';
import { HomeRoutes } from '../../routes/types';
import AssetsList from '../Wallet/AssetsList';

import { FullTokenListRoutesParams } from './routes';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type FullTokenListProps = NativeStackScreenProps<
  FullTokenListRoutesParams,
  HomeRoutes.FullTokenListScreen
>;

// type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.FullTokenListScreen>;

const FullTokenList: FC<FullTokenListProps> = () => {
  const navigation = useNavigation();
  const intl = useIntl();
  useEffect(() => {
    const title = intl.formatMessage({ id: 'asset__tokens' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl]);

  return <AssetsList flatStyle />;
};
export default FullTokenList;
