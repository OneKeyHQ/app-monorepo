import React, { ComponentProps, FC, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Divider, Icon, Pressable, Textarea } from '@onekeyhq/components';
import { getClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigation } from '../../hooks';
import { ModalRoutes, RootRoutes } from '../../routes/types';
import { gotoScanQrcode } from '../../utils/gotoScanQrcode';
import { AddressBookRoutes } from '../../views/AddressBook/routes';

type AddressInputPlugin = 'paste' | 'contact' | 'scan';

type AddressInputProps = ComponentProps<typeof Textarea> & {
  networkId?: string;
  value?: string;
  onChange?: (address: string) => void;
  onChangeAddressName?: (address: string) => void;
  plugins?: AddressInputPlugin[];
};

const AddressInput: FC<AddressInputProps> = ({
  value,
  onChange,
  onChangeAddressName,
  plugins = ['paste', 'scan'],
  networkId,
  ...rest
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const [isFocus, setFocus] = useState(false);
  const onPaste = useCallback(async () => {
    const text = await getClipboard();
    onChange?.(text);
  }, [onChange]);
  const onScan = useCallback(() => {
    gotoScanQrcode(onChange);
  }, [onChange]);
  const onContacts = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.AddressBook,
      params: {
        screen: AddressBookRoutes.PickAddressRoute,
        params: {
          networkId,
          onSelected: ({ address, name }) => {
            onChange?.(address);
            if (name) {
              onChangeAddressName?.(name);
            }
          },
        },
      },
    });
  }, [navigation, onChange, networkId, onChangeAddressName]);
  return (
    <Box
      w="full"
      borderRadius={12}
      overflow="hidden"
      borderWidth="1"
      borderColor={isFocus ? 'focused-default' : 'border-default'}
    >
      <Textarea
        borderRadius={0}
        w="full"
        value={value}
        onChangeText={onChange}
        placeholder={intl.formatMessage({ id: 'form__address' })}
        borderWidth="0"
        onFocus={() => {
          setFocus(true);
        }}
        onBlur={() => setFocus(false)}
        {...rest}
      />

      <Divider />
      <Box display="flex" flexDirection="row" bg="action-secondary-default">
        {plugins.includes('paste') && platformEnv.canGetClipboard ? (
          <Pressable
            flex="1"
            justifyContent="center"
            alignItems="center"
            py="3"
            borderRightWidth={0.5}
            borderRightColor="border-default"
            onPress={onPaste}
          >
            <Icon name="ClipboardSolid" />
          </Pressable>
        ) : null}
        {plugins.includes('contact') ? (
          <Pressable
            flex="1"
            justifyContent="center"
            alignItems="center"
            py="3"
            borderRightWidth={0.5}
            borderRightColor="border-default"
            onPress={onContacts}
          >
            <Icon name="BookOpenSolid" />
          </Pressable>
        ) : null}
        {plugins.includes('scan') ? (
          <Pressable
            flex="1"
            justifyContent="center"
            alignItems="center"
            py="3"
            onPress={onScan}
          >
            <Icon name="ScanSolid" />
          </Pressable>
        ) : null}
      </Box>
    </Box>
  );
};

export default AddressInput;
