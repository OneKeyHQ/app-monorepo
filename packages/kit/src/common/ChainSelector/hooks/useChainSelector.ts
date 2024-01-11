import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EChainSelectorPages } from '../router/type';

export function useChainSelector() {
  const navigation = useAppNavigation();
  const select = () => {
    navigation.pushModal(EModalRoutes.ChainSelectorModal, {
      screen: EChainSelectorPages.Selector,
    });
  };
  return {
    select,
  };
}
