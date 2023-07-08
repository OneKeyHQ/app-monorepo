import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Text, useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { BulkSenderModeEnum } from '@onekeyhq/engine/src/types/batchTransfer';
import { useNativeToken } from '@onekeyhq/kit/src/hooks';

import { useActiveWalletAccount } from '../../../hooks';
import { TokenOutbox } from '../OneToMany/TokenOutbox';
import { BulkSenderTypeEnum } from '../types';

type Props = {
  mode: BulkSenderModeEnum;
};

const emptyHeader = () => <Text />;
function BulkSenderTabs(props: Props) {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const [tabbarBgColor] = useThemeValue(['background-default']);

  const { accountId, networkId, accountAddress, network } =
    useActiveWalletAccount();

  const nativeToken = useNativeToken(networkId);

  const bulkSenderTabs = useMemo(() => {
    const tabs = [
      <Tabs.Tab
        name={BulkSenderTypeEnum.NativeToken}
        label={nativeToken?.symbol ?? ''}
      >
        <TokenOutbox
          accountId={accountId}
          networkId={networkId}
          accountAddress={accountAddress}
          type={BulkSenderTypeEnum.NativeToken}
        />
      </Tabs.Tab>,
    ];

    if (network?.settings.tokenEnabled) {
      tabs.push(
        <Tabs.Tab
          name={BulkSenderTypeEnum.Token}
          label={intl.formatMessage({ id: 'form__token' })}
        >
          <TokenOutbox
            accountId={accountId}
            networkId={networkId}
            accountAddress={accountAddress}
            type={BulkSenderTypeEnum.Token}
          />
        </Tabs.Tab>,
      );
    }
    return tabs;
  }, [
    accountAddress,
    accountId,
    intl,
    nativeToken?.symbol,
    network?.settings.tokenEnabled,
    networkId,
  ]);

  return (
    <Tabs.Container
      headerContainerStyle={{
        width: '100%',
        maxWidth: 768,
      }}
      containerStyle={{
        width: '100%',
        maxWidth: 768,
        marginHorizontal: 'auto',
        backgroundColor: tabbarBgColor,
        alignSelf: 'center',
        flex: 1,
      }}
      renderHeader={emptyHeader}
      headerHeight={isVertical ? 0 : 30}
      // scrollEnabled={false}
      disableRefresh
    >
      {bulkSenderTabs}
    </Tabs.Container>
  );
}

export { BulkSenderTabs };
