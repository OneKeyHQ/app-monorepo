import type { FC } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Collapse,
  List,
  Text,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';

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
    <Text my={3}>
      <Typography.Body2Strong
        bg="surface-highlight-default"
        borderRadius="6px"
        numberOfLines={1}
        ml={isVertical ? 4 : 6}
        color="text-default"
        px="6px"
        py="2px"
      >
        {poolType}
      </Typography.Body2Strong>
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
      borderColor="divider"
      mb="6"
      defaultCollapsed={false}
      renderCustomTrigger={(toggle, collapsed) => (
        <OverviewDefiBoxHeader
          name={protocolName}
          rate={new B(protocolValue)
            .div(accountAllValues.value)
            .multipliedBy(100)}
          desc={
            <Typography.Heading>
              <FormatCurrencyNumber value={new B(protocolValue)} />
            </Typography.Heading>
          }
          extra={
            +claimableValue > 0 ? (
              <Typography.Body2Strong color="text-subdued">
                {intl.formatMessage(
                  { id: 'form__claimable_str' },
                  {
                    0: <FormatCurrencyNumber value={new B(claimableValue)} />,
                  },
                )}
              </Typography.Body2Strong>
            ) : undefined
          }
          icon={protocolIcon}
          toggle={toggle}
          collapsed={collapsed}
        />
      )}
    >
      <List
        m="0"
        w="100%"
        data={Object.entries(pools)}
        renderItem={({ item }) => (
          <VStack borderTopWidth="1px" borderTopColor="divider" pt="2" pb="4">
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
        )}
        keyExtractor={(item) => item[0]}
      />
    </Collapse>
  );
};
