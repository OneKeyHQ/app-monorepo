import React, { useCallback } from 'react';

import { Icon, Pressable, Typography, utils } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../hooks';
import { ModalRoutes, RootRoutes } from '../../routes/types';
import { setReceiving } from '../../store/reducers/swap';
import { AddressBookRoutes } from '../AddressBook/routes';

import { useReceivingAddress } from './hooks/useSwap';

const SwapReceiving = () => {
  const navigation = useNavigation();
  const outputTokenNetwork = useAppSelector((s) => s.swap.outputTokenNetwork);
  const { address, name } = useReceivingAddress();

  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.AddressBook,
      params: {
        screen: AddressBookRoutes.EnterAddressRoute,
        params: {
          defaultAddress: address,
          networkId: outputTokenNetwork?.id,
          onSelected: ({ address: selectedAddress, name: selectedName }) => {
            backgroundApiProxy.dispatch(
              setReceiving({ address: selectedAddress, name: selectedName }),
            );
          },
        },
      },
    });
  }, [navigation, outputTokenNetwork?.id, address]);

  let text = '';
  if (address && name) {
    text = `${name}(${address.slice(-4)})`;
  } else if (address) {
    text = `${utils.shortenAddress(address)}`;
  }

  if (address) {
    return (
      <Pressable flexDirection="row" alignItems="center" onPress={onPress}>
        <Typography.Body1 color="text-default" mr="1" numberOfLines={1}>
          {text}
        </Typography.Body1>
        <Icon size={20} name="PencilSolid" />
      </Pressable>
    );
  }

  return null;
};

export default SwapReceiving;
