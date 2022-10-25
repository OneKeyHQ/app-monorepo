import React, { FC, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  HStack,
  IconButton,
  Input,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { useActiveWalletAccount, useNavigation } from '../../hooks';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';

import showAboutOverlay from './Overlays/About';
import SvgRevoke from './Svg';
import { RevokeRoutes } from './types';

type Props = {
  onAddressChange: (address: string) => void;
};

const RevokeHeader: FC<Props> = ({ onAddressChange }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const [addressOrName, setAddressOrName] = useState('');
  const { accountAddress, networkId } = useActiveWalletAccount();
  const isVertical = useIsVerticalLayout();

  useEffect(() => {
    onAddressChange?.(addressOrName);
  }, [addressOrName, onAddressChange]);

  useEffect(() => {
    if (accountAddress) {
      setAddressOrName(accountAddress);
    }
  }, [accountAddress, networkId]);

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
      <Input
        flex="1"
        value={addressOrName}
        minWidth={isVertical ? undefined : '480px'}
        onChangeText={setAddressOrName}
        textAlign="center"
        placeholder={intl.formatMessage({ id: 'form__enter_address_ens_name' })}
      />
    </>
  );
};

export default RevokeHeader;
