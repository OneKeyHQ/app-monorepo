import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IChainSelectorParams } from '@onekeyhq/shared/src/routes/chainSelector';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { ChainSelectorListView } from './ChainSelectorListView';
import { ChainSelectorSectionList } from './ChainSelectorSectionList';

type IPureChainSelectorProps = {
  networks: IServerNetwork[];
  title?: string;
  networkId?: string;
  onPressItem?: (network: IServerNetwork) => void;
  unavailable?: IServerNetwork[];
  grouped?: boolean;
  recentNetworksEnabled?: boolean;
  accountNetworkValues?: Record<string, string>;
  accountNetworkValueCurrency?: string;
  hideLowValueNetworkValue?: boolean;
  featuredNetwork?: IChainSelectorParams['featuredNetwork'];
};

export const PureChainSelector: FC<IPureChainSelectorProps> = ({
  networks,
  title,
  networkId,
  onPressItem,
  unavailable,
  grouped = true,
  recentNetworksEnabled = true,
  accountNetworkValues,
  accountNetworkValueCurrency,
  hideLowValueNetworkValue,
  featuredNetwork,
}) => {
  const intl = useIntl();

  return (
    <Page lazyLoad safeAreaEnabled={false}>
      <Page.Header
        title={
          title || intl.formatMessage({ id: ETranslations.global_networks })
        }
      />
      <Page.Body>
        {grouped ? (
          <ChainSelectorSectionList
            networkId={networkId}
            networks={networks}
            onPressItem={onPressItem}
            unavailable={unavailable}
            recentNetworksEnabled={recentNetworksEnabled}
            accountNetworkValues={accountNetworkValues}
            accountNetworkValueCurrency={accountNetworkValueCurrency}
            hideLowValueNetworkValue={hideLowValueNetworkValue}
          />
        ) : (
          <ChainSelectorListView
            networkId={networkId}
            networks={networks}
            onPressItem={onPressItem}
            accountNetworkValues={accountNetworkValues}
            accountNetworkValueCurrency={accountNetworkValueCurrency}
            hideLowValueNetworkValue={hideLowValueNetworkValue}
            featuredNetwork={featuredNetwork}
          />
        )}
      </Page.Body>
    </Page>
  );
};
