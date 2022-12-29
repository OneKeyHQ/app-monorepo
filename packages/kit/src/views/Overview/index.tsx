import type { FC } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  HStack,
  Icon,
  Spinner,
  Typography,
} from '@onekeyhq/components';

import { useAppSelector } from '../../hooks';

import { OverviewDefiProtocol } from './components/OverviewDefiProtocol';

export type OverviewDefiListProps = {
  networkId: string;
  address: string;
};

const OverviewDefiListComponent: FC<OverviewDefiListProps> = (props) => {
  const pageSize = 20;
  const intl = useIntl();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const { networkId, address } = props;

  const loadMore = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setPage((p) => p + 1);
      setLoading(false);
    }, 600);
  }, []);

  const defis = useAppSelector(
    (s) => s.overview.defi?.[`${networkId}--${address}`] ?? [],
  );

  const loadMoreButton = useMemo(() => {
    if (page * pageSize >= defis.length) {
      return null;
    }
    return (
      <Center>
        <Button size="sm" onPress={loadMore}>
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <HStack>
              <Typography.Button2 mr="2">
                {intl.formatMessage({ id: 'action__load_more' })}
              </Typography.Button2>
              <Icon name="ArrowSmDownMini" size={20} />
            </HStack>
          )}
        </Button>
      </Center>
    );
  }, [loadMore, defis, page, intl, loading]);

  return (
    <Box mb="6">
      {defis.slice(0, page * pageSize).map((item) => (
        <OverviewDefiProtocol {...item} key={item._id?.protocolId} />
      ))}
      {loadMoreButton}
    </Box>
  );
};

export const OverviewDefiList = memo(OverviewDefiListComponent);
