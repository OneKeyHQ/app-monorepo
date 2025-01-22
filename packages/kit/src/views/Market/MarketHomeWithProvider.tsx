import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { AccountSelectorProviderMirror } from '../../components/AccountSelector';
import { MarketHome } from './MarketHome';
import { MarketWatchListProviderMirror } from './MarketWatchListProviderMirror';

export default function MarketHomeWithProvider() {
  PrimeRouter;
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <MarketWatchListProviderMirror
        storeName={EJotaiContextStoreNames.marketWatchList}
      >
        <MarketHome />
      </MarketWatchListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
