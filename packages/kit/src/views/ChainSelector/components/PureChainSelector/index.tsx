import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { PureChainSelectorContent } from './ChainSelectorContent';

type IPureChainSelectorProps = {
  networks: IServerNetwork[];
  title?: string;
  networkId?: string;
  onPressItem?: (network: IServerNetwork) => void;
};

export const PureChainSelector: FC<IPureChainSelectorProps> = ({
  networks,
  title,
  networkId,
  onPressItem,
}) => {
  const intl = useIntl();

  return (
    <Page>
      <Page.Header
        title={
          title || intl.formatMessage({ id: ETranslations.global_networks })
        }
      />
      <Page.Body>
        <PureChainSelectorContent
          networkId={networkId}
          networks={networks}
          onPressItem={onPressItem}
        />
      </Page.Body>
    </Page>
  );
};
