import { FC, memo, useEffect } from 'react';

import { List } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';

import { OverviewDefiProtocol } from './OverviewDefiProtocol';

export type OverviewDefiListProps = {
  networkId: string;
  address: string;
};

const OverviewDefiListComponent: FC<OverviewDefiListProps> = (props) => {
  const { networkId, address } = props;

  useEffect(() => {
    if (!address) {
      return;
    }
    backgroundApiProxy.serviceOverview.subscribe([
      {
        ...props,
        scanTypes: ['defi'],
      },
    ]);
  }, [props, address]);

  const defis = useAppSelector(
    (s) => s.overview.defi?.[`${networkId}--${address}`] ?? [],
  );

  return (
    <List
      m="0"
      data={defis}
      renderItem={({ item }) => (
        <OverviewDefiProtocol
          networkId={networkId}
          {...item}
          key={item._id?.protocolId}
        />
      )}
      keyExtractor={(item) => item._id.protocolId}
    />
  );
};

export const OverviewDefiList = memo(OverviewDefiListComponent);
