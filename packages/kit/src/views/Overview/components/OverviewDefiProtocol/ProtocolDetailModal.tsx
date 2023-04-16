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
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';

import { FormatCurrencyNumber } from '../../../../components/Format';
import { useAccountValues, useAppSelector } from '../../../../hooks';
import { useNavigationBack } from '../../../../hooks/useAppNavigation';
import { useCurrentFiatValue } from '../../../../hooks/useTokens';
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
  const close = useModalClose();
  const goBack = useNavigationBack({
    fallback: close,
  });

  const { networkId, address, protocolId, accountId, poolCode } = route.params;

  const currentFiatValue = useCurrentFiatValue();

  const accountAllValue = useAccountValues({
    networkId,
    accountId,
  }).value;

  const protocol = useAppSelector((s) =>
    s.overview.defi?.[`${networkId}--${address}`]?.find(
      (item) => item._id.protocolId === protocolId,
    ),
  );

  const rate = useMemo(
    () =>
      new B(protocol?.protocolValue ?? 0)
        .multipliedBy(currentFiatValue)
        .div(accountAllValue)
        .multipliedBy(100),
    [protocol?.protocolValue, accountAllValue, currentFiatValue],
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

  if (!protocol) {
    goBack();
    return null;
  }

  return (
    <Modal
      size="2xl"
      hidePrimaryAction
      hideSecondaryAction={!protocol.protocolUrl}
      // @ts-ignore
      header={header}
      footer={!protocol.protocolUrl ? null : undefined}
      headerDescription={headerDescription}
      onSecondaryActionPress={open}
      secondaryActionProps={{
        children: intl.formatMessage(
          { id: 'form__visit_str' },
          {
            0: protocol.protocolName,
          },
        ),
      }}
      scrollViewProps={{
        children: (
          <OverviewDefiProtocol
            {...protocol}
            showHeader={false}
            bgColor="surface-default"
            poolCode={poolCode}
          />
        ),
      }}
    />
  );
};

export default OverviewProtocolDetail;
