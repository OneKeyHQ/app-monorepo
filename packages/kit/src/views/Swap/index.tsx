import { memo, useCallback } from 'react';

import { Page, Text } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorActiveAccount,
  AccountSelectorProvider,
  AccountSelectorTrigger,
} from '../../components/AccountSelector';

import { withSwapProvider } from './container/WithSwapProvider';

const Swap = () => {
  console.log('swap');
  // const navigation =
  //   useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  // const onSelectNetwork = useCallback(
  //   (type: 'from' | 'to') => {
  //     navigation.pushModal(EModalRoutes.SwapModal, {
  //       screen: EModalSwapRoutes.SwapNetworkSelect,
  //       params: { type },
  //     });
  //   },
  //   [navigation],
  // );
  // const onSelectToken = useCallback(
  //   (type: 'from' | 'to') => {
  //     if (!fromNetwork) {
  //       Toast.error({ title: 'please select network' });
  //       return;
  //     }
  //     navigation.pushModal(EModalRoutes.SwapModal, {
  //       screen: EModalSwapRoutes.SwapTokenSelect,
  //       params: { type },
  //     });
  //   },
  //   [fromNetwork, navigation],
  // );

  // const onInputChange = useCallback(
  //   async (text: string) => {
  //     console.log('onInputChange', text);
  //     setFromInputAmount(text);
  //     const inputAmountNumber = Number(text);
  //     await quoteFetch(inputAmountNumber);
  //   },
  //   [quoteFetch],
  // );

  const onSwap = useCallback(async () => {}, []);
  return (
    <Page>
      <Page.Body space="$4">
        <Text>Swap</Text>
        <AccountSelectorProvider
          config={{
            sceneName: EAccountSelectorSceneName.swap,
            sceneUrl: '',
          }}
          enabledNum={[0, 1]}
        >
          <AccountSelectorTrigger num={0} />
          <AccountSelectorActiveAccount num={0} />

          <AccountSelectorTrigger num={1} />
          <AccountSelectorActiveAccount num={1} />
        </AccountSelectorProvider>
      </Page.Body>
    </Page>
  );
};

export default memo(withSwapProvider(Swap));
