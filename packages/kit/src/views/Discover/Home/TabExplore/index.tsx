import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Empty } from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

import FavContainer from '../../Explorer/FavContainer';
import { useContextCategoryDapps } from '../context';
import { DAppCategories } from '../DappCategories';
import { DappItemPlain } from '../DappRenderItem';
import { DappItemPlainContainerLayout } from '../DappRenderLayout';
import { EmptySkeleton } from '../EmptySkeleton';
import { SelectorButton } from '../SelectorButton';

import type { DAppItemType } from '../../type';

const DappsItemsRender = ({
  loading,
  data,
  networkId,
}: {
  data: DAppItemType[];
  loading: boolean;
  networkId: string;
}) => {
  const intl = useIntl();
  if (loading) {
    return <EmptySkeleton />;
  }
  if (data.length === 0 && !isAllNetworks(networkId)) {
    return (
      <Box w="full">
        <Empty
          title={intl.formatMessage({ id: 'empty__no_data' })}
          emoji="🕐"
        />
      </Box>
    );
  }
  return (
    <DappItemPlainContainerLayout space={2}>
      {data.map((item) => (
        <FavContainer
          key={item._id}
          url={item.url}
          hoverButtonProps={{
            right: '8px',
            top: '8px',
          }}
        >
          <DappItemPlain
            logoURI={item.logoURL}
            title={item.name}
            description={item.subtitle}
            networkIds={item.networkIds}
            url={item.url}
            dappId={item._id}
          />
        </FavContainer>
      ))}
    </DappItemPlainContainerLayout>
  );
};

const SectionExploreContent = () => {
  const { data: dapps, loading } = useContextCategoryDapps();

  const [networkId, setNetworkId] = useState('all--0');

  const networkIds = useMemo(() => {
    const items = dapps.reduce(
      (result, item) => result.concat(item.networkIds),
      [] as string[],
    );
    return Array.from(new Set(items));
  }, [dapps]);

  const items = useMemo(() => {
    if (isAllNetworks(networkId)) {
      return dapps;
    }
    return dapps.filter((o) => o.networkIds.includes(networkId));
  }, [networkId, dapps]);

  if (!dapps) {
    return <EmptySkeleton />;
  }

  return (
    <Box>
      <Box px="2" pb="2" flexDirection="row" justifyContent="space-between">
        <SelectorButton
          networkIds={networkIds}
          networkId={networkId}
          onItemSelect={setNetworkId}
        />
      </Box>
      <Box py="2" px="4">
        <DappsItemsRender
          data={items}
          networkId={networkId}
          loading={loading}
        />
      </Box>
    </Box>
  );
};

export const SectionExplore = () => (
  <Box>
    <Box py="4">
      <DAppCategories />
    </Box>
    <SectionExploreContent />
  </Box>
);
