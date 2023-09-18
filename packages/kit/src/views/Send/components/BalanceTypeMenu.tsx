import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Text } from '@onekeyhq/components';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import { isBitcoinNetwork } from '@onekeyhq/shared/src/engine/engineConsts';

import type { MessageDescriptor } from 'react-intl';

type BalanceType = 'Auto' | 'Manually';

function BalanceTypeMenu({
  networkId,
  callback,
}: {
  networkId: string;
  callback: (value: BalanceType) => void;
}) {
  const intl = useIntl();

  const onSelect = useCallback(
    (value: BalanceType) => {
      callback(value);
    },
    [callback],
  );

  const options: {
    id: MessageDescriptor['id'];
    onPress: () => void;
  }[] = useMemo(
    () => [
      {
        id: 'action__top_up_btc',
        onPress: () => {
          onSelect('Auto');
        },
      },
      {
        id: 'action__withdraw_to_btc_account',
        onPress: () => {
          onSelect('Manually');
        },
      },
    ],
    [onSelect],
  );

  if (!isBitcoinNetwork(networkId)) {
    return (
      <Text typography="CaptionStrong" color="text-default" mr={2}>
        {intl.formatMessage({ id: 'content__available_balance' })}
      </Text>
    );
  }

  return (
    <Box>
      <BaseMenu options={options} menuWidth={280}>
        <Pressable flex={1} alignItems="center" flexDirection="row">
          <Text typography="CaptionStrong" color="text-default" mr={2}>
            {intl.formatMessage({ id: 'content__available_balance' })}(Auto)
          </Text>
          <Icon name="ChevronDownMini" size={12} />
        </Pressable>
      </BaseMenu>
    </Box>
  );
}

export default BalanceTypeMenu;
