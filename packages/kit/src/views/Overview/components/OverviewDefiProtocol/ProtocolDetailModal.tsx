import type { FC } from 'react';
import { useMemo } from 'react';

import { OverviewDefiProtocol } from './index';

import { useRoute } from '@react-navigation/core';
import B from 'bignumber.js';

import {
  Badge,
  Box,
  HStack,
  Modal,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';

import { FormatCurrencyNumber } from '../../../../components/Format';
import { useAccountAllValues, useAppSelector } from '../../../../hooks';
import { useNavigationBack } from '../../../../hooks/useAppNavigation';

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
  const isVertical = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const close = useModalClose();
  const goBack = useNavigationBack({
    fallback: close,
  });

  const { networkId, address, protocolId } = route.params;

  const accountAllValue = useAccountAllValues(networkId, address).value;

  const protocol = useAppSelector((s) =>
    s.overview.defi?.[`${networkId}--${address}`]?.find(
      (item) => item._id.protocolId === protocolId,
    ),
  );

  const rate = useMemo(
    () =>
      new B(protocol?.protocolValue ?? 0)
        .div(accountAllValue)
        .multipliedBy(100),
    [protocol?.protocolValue, accountAllValue],
  );

  const headerDescription = useMemo(() => {
    if (isVertical) {
      return (
        <Typography.Caption>
          <FormatCurrencyNumber value={new B(protocol?.protocolValue ?? 0)} />
        </Typography.Caption>
      );
    }
    return null;
  }, [isVertical, protocol]);

  const header = useMemo(() => {
    if (isVertical) {
      return (
        <HStack>
          <Token
            token={{
              logoURI: protocol?.protocolIcon,
              name: protocol?.protocolName,
            }}
            size={5}
          />
          <Typography.Heading ml="3">
            {protocol?.protocolName}
          </Typography.Heading>
        </HStack>
      );
    }

    return (
      <HStack>
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
          <FormatCurrencyNumber value={new B(protocol?.protocolValue ?? 0)} />
        </Typography.Heading>
        {rate.isGreaterThan(0) ? (
          <Badge title={`${rate.toFixed(2)}%`} size="lg" ml="2" />
        ) : null}
      </HStack>
    );
  }, [isVertical, protocol, rate]);

  if (!protocol) {
    goBack();
    return null;
  }

  return (
    <Modal
      size="2xl"
      hideSecondaryAction
      hidePrimaryAction
      footer={null}
      // @ts-ignore
      header={header}
      headerDescription={headerDescription}
    >
      <OverviewDefiProtocol
        {...protocol}
        showHeader={false}
        bgColor="surface-default"
      />
    </Modal>
  );
};

export default OverviewProtocolDetail;
