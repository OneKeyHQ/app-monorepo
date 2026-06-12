import { useRoute } from '@react-navigation/core';

import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';

import { SwapKLineContentWithProvider } from './SwapKLineContent';

import type { RouteProp } from '@react-navigation/core';

export default function SwapKLineModal() {
  const route =
    useRoute<RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapKLine>>();
  const { storeName } = route.params;

  return <SwapKLineContentWithProvider storeName={storeName} variant="modal" />;
}
