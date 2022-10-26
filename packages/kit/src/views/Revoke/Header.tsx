import React, { FC, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  HStack,
  Icon,
  IconButton,
  Input,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { useActiveWalletAccount, useNavigation } from '../../hooks';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';

import { RevokeChainSelector } from './ChainSelector';
import showAboutOverlay from './Overlays/About';
import SvgRevoke from './Svg';
import { RevokeRoutes } from './types';

type Props = {
  onAddressChange: (address: string) => void;
  onNetworkChange: (id: string) => void;
  networkId: string;
};

const RevokeHeader: FC<Props> = ({
  onAddressChange,
  onNetworkChange,
  networkId,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const [addressOrName, setAddressOrName] = useState('');
  const { accountAddress, networkId: activeNetworkId } =
    useActiveWalletAccount();
  const isVertical = useIsVerticalLayout();

  useEffect(() => {
    onAddressChange?.(addressOrName);
  }, [addressOrName, onAddressChange, activeNetworkId]);

  useEffect(() => {
    onNetworkChange?.(activeNetworkId);
  }, [activeNetworkId, onNetworkChange]);

  useEffect(() => {
    if (accountAddress) {
      setAddressOrName(accountAddress);
    }
  }, [accountAddress, activeNetworkId]);

  const share = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Revoke,
      params: {
        screen: RevokeRoutes.ShareModal,
      },
    });
  }, [navigation]);

  return (
    <>
      <SvgRevoke />
      <HStack my="18px">
        <IconButton
          type="plain"
          name="InformationCircleSolid"
          iconSize={16}
          onPress={showAboutOverlay}
        >
          <Typography.Button2>
            {intl.formatMessage({ id: 'title__about' })}
          </Typography.Button2>
        </IconButton>
        <IconButton
          type="plain"
          name="PaperAirplaneSolid"
          iconSize={16}
          onPress={share}
        >
          <Typography.Button2>
            {intl.formatMessage({ id: 'title__share' })}
          </Typography.Button2>
        </IconButton>
      </HStack>
      <VStack w="full">
        <HStack flex="1" justifyContent="center">
          <Input
            flex="1"
            maxW="480px"
            value={addressOrName}
            minWidth={isVertical ? undefined : '480px'}
            onChangeText={setAddressOrName}
            textAlign="center"
            placeholder={intl.formatMessage({
              id: 'form__enter_address_ens_name',
            })}
          />
          <RevokeChainSelector value={networkId} onChange={onNetworkChange} />
        </HStack>
        {accountAddress !== addressOrName && (
          <HStack alignItems="center" justifyContent="center" mt="14">
            <Icon name="InformationCircleSolid" size={16} />
            <Typography.CaptionStrong ml="10px">
              {intl.formatMessage({
                id: 'content__connect_this_wallet_to_make_further_action',
              })}
            </Typography.CaptionStrong>
          </HStack>
        )}
      </VStack>
    </>
  );
};

export default RevokeHeader;
