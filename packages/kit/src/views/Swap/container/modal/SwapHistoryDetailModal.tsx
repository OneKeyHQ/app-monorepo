import { useRoute } from '@react-navigation/core';

import { Page, Text, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { withSwapProvider } from '../WithSwapProvider';

import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '../../router/Routers';
import type { RouteProp } from '@react-navigation/core';

const SwapHistoryDetailModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapHistoryDetail>
    >();
  const txHistory = route?.params?.txHistory;
  return (
    <Page>
      <YStack>
        <Text>{txHistory?.txInfo.txId}</Text>
      </YStack>
    </Page>
  );
};

export default withSwapProvider(SwapHistoryDetailModal);
