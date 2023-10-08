import { useContext, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Empty } from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

import FavContainer from '../../Explorer/FavContainer';
import { useContextCategoryDapps } from '../context';
import { DAppCategories } from '../DappCategories';
import { DappItemPlain } from '../DappRenderItem';
import {
  DappItemPlainContainerLayout,
  PageLayout,
  PageWidthLayoutContext,
} from '../DappRenderLayout';
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
  const { fullwidth } = useContext(PageWidthLayoutContext);
  if (loading || !fullwidth) {
    return <EmptySkeleton />;
  }
  if (data.length === 0 && !isAllNetworks(networkId)) {
    return (
      <Box w="full">
        <Empty
          title={intl.formatMessage({ id: 'empty__no_dapp' })}
          subTitle={intl.formatMessage({ id: 'empty__no_dapp_desc' })}
          emoji="🤷‍♂️"
        />
      </Box>
    );
  }
  return (
    <DappItemPlainContainerLayout space={2} offset={-32}>
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

  const networkIds = useMemo(
    () =>
      dapps.reduce(
        (result, item) => Array.from(new Set(result.concat(item.networkIds))),
        [] as string[],
      ),
    [dapps],
  );

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
  <PageLayout>
    <Box>
      <Box py="4">
        <DAppCategories />
      </Box>
      <SectionExploreContent />
    </Box>
  </PageLayout>
);
