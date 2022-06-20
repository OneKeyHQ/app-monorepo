import React, { useCallback } from 'react';

import { Icon, Pressable, Typography, utils } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../hooks';
import { ModalRoutes, RootRoutes } from '../../routes/types';
import { setReceiving } from '../../store/reducers/swap';
import { AddressBookRoutes } from '../AddressBook/routes';

const SwapReceiving = () => {
  const navigation = useNavigation();
  const outputTokenNetwork = useAppSelector((s) => s.swap.outputTokenNetwork);
  const receivingAddress = useAppSelector((s) => s.swap.receivingAddress);
  const receivingName = useAppSelector((s) => s.swap.receivingName);
  const { account } = useActiveWalletAccount();
  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.AddressBook,
      params: {
        screen: AddressBookRoutes.EnterAddressRoute,
        params: {
          defaultAddress: receivingAddress ?? account?.address,
          networkId: outputTokenNetwork?.id,
          onSelected: ({ address, name }) => {
            backgroundApiProxy.dispatch(setReceiving({ address, name }));
          },
        },
      },
    });
  }, [navigation, outputTokenNetwork?.id, receivingAddress, account?.address]);
  let address: string | undefined;
  let name: string | undefined;
  if (receivingAddress) {
    address = receivingAddress;
    name = receivingName;
  } else {
    address = account?.address;
    name = account?.name;
  }
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
        <Icon name="PencilSolid" />
      </Pressable>
    );
  }

  return null;
};

export default SwapReceiving;
