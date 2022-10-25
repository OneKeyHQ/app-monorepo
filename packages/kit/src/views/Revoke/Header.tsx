import React, { FC, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  HStack,
  IconButton,
  Input,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { useActiveWalletAccount } from '../../hooks';

import showAboutOverlay from './Overlays/About';
import SvgRevoke from './Svg';

type Props = {
  onAddressChange: (address: string) => void;
};

const RevokeHeader: FC<Props> = ({ onAddressChange }) => {
  const intl = useIntl();
  const [addressOrName, setAddressOrName] = useState('');
  const { accountAddress } = useActiveWalletAccount();
  const isVertical = useIsVerticalLayout();

  useEffect(() => {
    onAddressChange?.(addressOrName);
  }, [addressOrName, onAddressChange]);

  useEffect(() => {
    if (accountAddress) {
      setAddressOrName(accountAddress);
    }
  }, [accountAddress]);

  return (
    <>
      <SvgRevoke />
      <HStack my="18px">
        <IconButton type="plain" name="InformationCircleSolid" iconSize={16}>
          <Typography.Button2 onPress={showAboutOverlay}>
            {intl.formatMessage({ id: 'title__about' })}
          </Typography.Button2>
        </IconButton>
        <IconButton
          type="plain"
          name="PaperAirplaneSolid"
          iconSize={16}
          isDisabled
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
