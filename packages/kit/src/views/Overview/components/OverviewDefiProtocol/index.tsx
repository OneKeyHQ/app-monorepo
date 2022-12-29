import type { FC } from 'react';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { FormatCurrencyNumber } from '../../../../components/Format';
import { useAccountAllValues, useActiveWalletAccount } from '../../../../hooks';

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

export const OverviewDefiProtocol: FC<OverviewDefiRes> = ({
  _id,
  pools,
  protocolValue,
  protocolName,
  protocolIcon,
  claimableValue,
}) => {
  const intl = useIntl();

  const { networkId, accountAddress } = useActiveWalletAccount();

  const accountAllValues = useAccountAllValues(networkId, accountAddress);

  return (
    <Collapse
      borderRadius="12px"
      bg="surface-default"
      borderWidth="1px"
      borderColor="border-subdued"
      mb="6"
      defaultCollapsed={platformEnv.isNative}
      overflow="hidden"
      renderCustomTrigger={(toggle, collapsed) => (
        <OverviewDefiBoxHeader
          name={protocolName}
          rate={new B(protocolValue)
            .div(accountAllValues.value)
            .multipliedBy(100)}
          desc={
            <Text typography={{ md: 'Heading', sm: 'Body1Strong' }}>
              <FormatCurrencyNumber value={new B(protocolValue)} />
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
                    0: <FormatCurrencyNumber value={new B(claimableValue)} />,
                  },
                )}
              </Text>
            ) : undefined
          }
          icon={protocolIcon}
          toggle={toggle}
          collapsed={collapsed}
        />
      )}
    >
      <Box>
        {Object.entries(pools).map((item) => (
          <VStack key={item[0]} borderTopWidth="1px" borderTopColor="divider">
            <PoolName
              poolType={item?.[0] as OverviewDeFiPoolType}
              poolName={item?.[1]?.[0]?.poolName}
            />
            <OverviewDefiPool
              networkId={_id.networkId}
              poolType={item?.[0]}
              pools={item?.[1]}
            />
          </VStack>
        ))}
      </Box>
    </Collapse>
  );
};
