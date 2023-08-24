import type { FC } from 'react';
import { useMemo } from 'react';

import { OverviewDefiProtocol, useOpenProtocolUrl } from './index';

import { useRoute } from '@react-navigation/core';
import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Modal,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { FormatCurrencyNumber } from '../../../../components/Format';
import { LazyDisplayView } from '../../../../components/LazyDisplayView';
import { useAppSelector } from '../../../../hooks';
import { OverviewBadge } from '../OverviewBadge';

import type {
  OverviewModalRoutes,
  OverviewModalRoutesParams,
} from '../../types';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  OverviewModalRoutesParams,
  OverviewModalRoutes.OverviewProtocolDetail
>;

const OverviewProtocolDetail: FC = () => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const route = useRoute<RouteProps>();

  const { networkId, accountId, protocol, poolCode } = route.params;

  const stats = useAppSelector(
    (s) => s.overview.overviewStats?.[networkId]?.[accountId],
  );

  const rate = useMemo(
    () =>
      new B(protocol.protocolValue)
        .div(stats?.summary?.totalValue ?? 0)
        .multipliedBy(100),
    [protocol, stats?.summary?.totalValue],
  );
  const headerDescription = useMemo(() => {
    if (isVertical) {
      return (
        <Typography.Caption>
          <FormatCurrencyNumber
            value={0}
            convertValue={new B(protocol?.protocolValue ?? 0)}
          />
        </Typography.Caption>
      );
    }
    return null;
  }, [isVertical, protocol]);

  const header = useMemo(() => {
    if (isVertical || !!poolCode) {
      return (
        <Typography.Heading ml="3">{protocol?.protocolName}</Typography.Heading>
      );
    }

    return (
      <HStack alignItems="center">
        <Token token={{ logoURI: protocol?.protocolIcon }} size={8} />
        <Typography.Heading ml="3">{protocol?.protocolName}</Typography.Heading>
        <Box
          mx="2"
          my="auto"
          w="1"
          h="1"
          borderRadius="2px"
          bg="text-default"
        />
        <Typography.Heading>
          <FormatCurrencyNumber
            value={0}
            convertValue={new B(protocol?.protocolValue ?? 0)}
          />
        </Typography.Heading>
        {rate.isGreaterThan(0) ? <OverviewBadge rate={rate} /> : null}
      </HStack>
    );
  }, [isVertical, protocol, rate, poolCode]);

  const open = useOpenProtocolUrl(protocol);

  return (
    <Modal
      size="2xl"
      height="560px"
      hidePrimaryAction
      hideSecondaryAction={!protocol?.protocolUrl}
      // @ts-ignore
      header={header}
      footer={!protocol?.protocolUrl ? null : undefined}
      headerDescription={headerDescription}
      onSecondaryActionPress={open}
      secondaryActionProps={{
        children: intl.formatMessage(
          { id: 'form__visit_str' },
          {
            0: protocol?.protocolName ?? '',
          },
        ),
      }}
      scrollViewProps={{
        children: (
          <LazyDisplayView delay={0}>
            <OverviewDefiProtocol
              {...protocol}
              showHeader={false}
              bgColor="surface-default"
              poolCode={poolCode}
            />
          </LazyDisplayView>
        ),
      }}
    />
  );
};

export default OverviewProtocolDetail;
