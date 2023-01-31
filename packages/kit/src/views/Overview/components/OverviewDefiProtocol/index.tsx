import type { FC } from 'react';
import { useMemo } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Collapse,
  Text,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { ErrorBoundary } from '../../../../components/ErrorBoundary';
import { FormatCurrencyNumber } from '../../../../components/Format';
import { useAccountUsdValues, useActiveWalletAccount } from '../../../../hooks';

import { OverviewDefiBoxHeader } from './Header';
import { OverviewDefiPool } from './OverviewDefiPool';

import type { OverviewDeFiPoolType, OverviewDefiRes } from '../../types';

const PoolName: FC<{
  poolType: OverviewDeFiPoolType;
  poolName: string;
}> = ({ poolType }) => {
  const isVertical = useIsVerticalLayout();
  return (
    <Text ml={isVertical ? 4 : 6} my="4">
      <Box px="6px" bg="surface-highlight-default" borderRadius="6px">
        <Typography.Body2Strong color="text-default" numberOfLines={1}>
          {poolType}
        </Typography.Body2Strong>
      </Box>
    </Text>
  );
};

export const OverviewDefiProtocol: FC<
  OverviewDefiRes & {
    showHeader?: boolean;
    bgColor?: string;
  }
> = ({
  _id,
  pools,
  protocolValue,
  protocolName,
  protocolIcon,
  claimableValue,
  showHeader = true,
  bgColor,
}) => {
  const intl = useIntl();

  const { networkId, accountId } = useActiveWalletAccount();

  const accountAllValues = useAccountUsdValues({
    networkId,
    accountId,
  });

  const content = useMemo(
    () => (
      <Box bg={bgColor}>
        {pools.map(([poolType, items], idx) => (
          <VStack
            key={poolType}
            borderTopWidth={idx === 0 ? 0 : '1px'}
            borderTopColor="divider"
          >
            <PoolName poolType={poolType} poolName={items?.[0]?.poolName} />
            <OverviewDefiPool
              networkId={_id.networkId}
              poolType={poolType}
              pools={items}
            />
          </VStack>
        ))}
      </Box>
    ),
    [bgColor, pools, _id],
  );

  return (
    <ErrorBoundary>
      <Collapse
        borderRadius="12px"
        bg="surface-default"
        borderWidth="1px"
        borderColor="border-subdued"
        mb="6"
        defaultCollapsed={false}
        overflow="hidden"
        renderCustomTrigger={(toggle, collapsed) =>
          showHeader ? (
            <OverviewDefiBoxHeader
              name={protocolName}
              rate={new B(protocolValue)
                .div(accountAllValues.value)
                .multipliedBy(100)}
              desc={
                <Text typography={{ md: 'Heading', sm: 'Body1Strong' }}>
                  <FormatCurrencyNumber
                    value={0}
                    convertValue={new B(protocolValue)}
                  />
                </Text>
              }
              extra={
                +claimableValue > 0 ? (
                  <Text
                    color="text-subdued"
                    typography={{ md: 'Body2Strong', sm: 'CaptionStrong' }}
                  >
                    {intl.formatMessage(
                      { id: 'form__claimable_str' },
                      {
                        0: (
                          <FormatCurrencyNumber
                            value={0}
                            convertValue={new B(claimableValue)}
                          />
                        ),
                      },
                    )}
                  </Text>
                ) : undefined
              }
              icon={protocolIcon}
              toggle={toggle}
              collapsed={collapsed}
            />
          ) : null
        }
      >
        {content}
      </Collapse>
    </ErrorBoundary>
  );
};
