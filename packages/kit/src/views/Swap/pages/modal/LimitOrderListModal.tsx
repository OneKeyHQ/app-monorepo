import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { SegmentControl, YStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';

import LimitOrderList from '../components/LimitOrderList';
import { SwapProviderMirror } from '../SwapProviderMirror';

const LimitOrderListModal = ({
  storeName,
}: {
  storeName: EJotaiContextStoreNames;
}) => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [limitOrderSelectedTab, setLimitOrderSelectedTab] = useState<
    'open' | 'history'
  >('open');
  const onClickCell = useCallback(
    (item: IFetchLimitOrderRes) => {
      navigation.push(EModalSwapRoutes.LimitOrderDetail, {
        orderId: item.orderId,
        orderItem: item,
        storeName,
      });
    },
    [navigation, storeName],
  );
  const intl = useIntl();
  return (
    <YStack px="$4" pt="$2" gap="$4" flex={1}>
      <SegmentControl
        w="100%"
        fullWidth
        options={[
          {
            label: intl.formatMessage({ id: ETranslations.Limit_open_order }),
            value: 'open',
          },
          {
            label: intl.formatMessage({
              id: ETranslations.Limit_order_history,
            }),
            value: 'history',
          },
        ]}
        onChange={(value) => {
          setLimitOrderSelectedTab(value as 'open' | 'history');
        }}
        value={limitOrderSelectedTab}
      />

      <LimitOrderList onClickCell={onClickCell} type={limitOrderSelectedTab} />
    </YStack>
  );
};

const LimitOrderListModalWithSwapProvider = ({
  storeName,
}: {
  storeName: EJotaiContextStoreNames;
}) => (
  <SwapProviderMirror storeName={storeName}>
    <LimitOrderListModal storeName={storeName} />
  </SwapProviderMirror>
);

export default function LimitOrderListModalWithAllProvider({
  storeName,
}: {
  storeName: EJotaiContextStoreNames;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.swap,
      }}
      enabledNum={[0, 1]}
    >
      <LimitOrderListModalWithSwapProvider storeName={storeName} />
    </AccountSelectorProviderMirror>
  );
}
