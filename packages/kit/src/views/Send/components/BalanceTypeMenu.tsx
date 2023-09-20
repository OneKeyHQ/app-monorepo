import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Text } from '@onekeyhq/components';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import { isBTCNetwork } from '@onekeyhq/shared/src/engine/engineConsts';

import { useAccount } from '../../../hooks';

import type { MessageDescriptor } from 'react-intl';

type BalanceType = 'Auto' | 'Manually';

function BalanceTypeMenu({
  accountId,
  networkId,
  callback,
}: {
  accountId: string;
  networkId: string;
  callback: (value: BalanceType) => void;
}) {
  const intl = useIntl();
  const [title, setTitle] = useState(
    intl.formatMessage({ id: 'form__available_balance_auto' }),
  );

  const { account } = useAccount({ accountId, networkId });

  const showMenu = useMemo(() => {
    if (!isBTCNetwork(networkId)) {
      return false;
    }
    if (!account?.customAddresses) {
      return false;
    }
    try {
      const customAddresses = JSON.parse(account.customAddresses);
      return Object.values(customAddresses).length > 0;
    } catch {
      // ignore parse error
      return false;
    }
  }, [account, networkId]);

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
        id: 'form__available_balance_auto',
        onPress: () => {
          onSelect('Auto');
          setTitle(intl.formatMessage({ id: 'form__available_balance_auto' }));
        },
      },
      {
        id: 'form__custom_addresses_balance',
        onPress: () => {
          onSelect('Manually');
          setTitle(
            intl.formatMessage({ id: 'form__custom_addresses_balance' }),
          );
        },
      },
    ],
    [onSelect, intl],
  );

  if (!showMenu) {
    return (
      <Text typography="CaptionStrong" color="text-default" mr={2}>
        {intl.formatMessage({ id: 'content__available_balance' })}
      </Text>
    );
  }

  return (
    <Box height={4}>
      <BaseMenu options={options} menuWidth={280}>
        <Pressable flex={1} alignItems="center" flexDirection="row">
          <Text typography="CaptionStrong" color="text-default" mr={2}>
            {title}
          </Text>
          <Icon name="ChevronDownMini" size={12} />
        </Pressable>
      </BaseMenu>
    </Box>
  );
}

export default BalanceTypeMenu;
