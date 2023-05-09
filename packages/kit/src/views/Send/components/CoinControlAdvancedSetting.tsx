import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Divider,
  HStack,
  IconButton,
  Pressable,
  Switch,
  Text,
  VStack,
} from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { IEncodedTxBtc } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  CoinControlModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';

type Props = {
  isChecked: boolean;
  onToggleCoinControl: () => void;
  onSelectedUtxos: (selectedUtxos: string[]) => void;
  encodedTx: IEncodedTxBtc;
  accountId: string;
  network: Network;
};
const CoinControlAdvancedSetting: FC<Props> = ({
  network,
  accountId,
  encodedTx,
  isChecked,
  onToggleCoinControl,
  onSelectedUtxos,
}) => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const inputLength = useMemo(
    () => encodedTx.inputs.length,
    [encodedTx.inputs],
  );

  const amount = useMemo(() => {
    const sumAmount = encodedTx.inputs.reduce(
      (sum, input) => sum.plus(input.value),
      new BigNumber(0),
    );
    return sumAmount.shiftedBy(-network.decimals).toFixed();
  }, [encodedTx.inputs, network.decimals]);

  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CoinControl,
      params: {
        screen: CoinControlModalRoutes.CoinControlModal,
        params: {
          networkId: network.id,
          accountId,
          isSelectMode: true,
          encodedTx,
          onConfirm: (selectedUtxos) => {
            navigation.goBack();
            onSelectedUtxos(selectedUtxos);
          },
        },
      },
    });
  }, [navigation, network.id, accountId, encodedTx, onSelectedUtxos]);

  return (
    <VStack
      p={4}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="border-default"
      borderRadius="xl"
    >
      <HStack alignItems="center" justifyContent="space-between">
        <Text typography="Body1Strong">
          {intl.formatMessage({ id: 'form__coin_control' })}
        </Text>
        <Switch
          labelType="false"
          isChecked={isChecked}
          onToggle={onToggleCoinControl}
        />
      </HStack>
      <Divider my={4} />
      <Pressable
        _pressed={{ bg: 'surface-pressed' }}
        _hover={{ bg: 'surface-hovered' }}
        borderRadius="xl"
        m={-2}
        isDisabled={!isChecked}
        onPress={onPress}
      >
        <HStack alignItems="center" justifyContent="space-between" mx={2}>
          <Text
            typography="Body2"
            color={isChecked ? 'text-default' : 'text-disabled'}
          >
            {intl.formatMessage(
              { id: 'form__str_selected' },
              { 0: inputLength },
            )}
          </Text>
          <HStack alignItems="center" mr="-10px">
            <Text
              typography="Body2"
              color={isChecked ? 'text-default' : 'text-disabled'}
            >
              {`${amount} ${network.symbol}`}
            </Text>
            <IconButton
              size="sm"
              name="ChevronRightMini"
              type="plain"
              iconColor={isChecked ? 'icon-subdued' : 'icon-disabled'}
              isDisabled={!isChecked}
              onPress={onPress}
            />
          </HStack>
        </HStack>
      </Pressable>
    </VStack>
  );
};

export default CoinControlAdvancedSetting;
