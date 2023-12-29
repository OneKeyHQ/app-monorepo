import type { IPageNavigationProp } from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { withSwapProvider } from '../WithSwapProvider';

import type { IModalSwapParamList } from '../../router/Routers';

const SwapHistoryDetailModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  return null;
};

export default withSwapProvider(SwapHistoryDetailModal);
