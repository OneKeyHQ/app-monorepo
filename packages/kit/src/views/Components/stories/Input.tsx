import React, { useCallback } from 'react';

import {
  Center,
  FormControl,
  Icon,
  Input,
  ScrollView,
  Stack,
} from '@onekeyhq/components';

const InputGallery = () => {
  const onQrScan = useCallback(() => {
    console.log('onQrScan');
  }, []);
  const onUser = useCallback(() => {
    console.log('onUser');
  }, []);
  return (
    <Center flex="1" bg="background-hovered">
      <ScrollView
        w="full"
        contentContainerStyle={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        }}
      >
        <Stack space="2">
          <Input placeholder="Placeholder" value="hello world" />
          <Input placeholder="Placeholder" small value="hello world" />
          <Input placeholder="Placeholder" value="disabled" isDisabled />
          <Input leftText="$" placeholder="Placeholder" />
          <Input leftIconName="AdjustmentsOutline" placeholder="Placeholder" />
          <Input
            leftIconName="MailSolid"
            rightIconName="AdjustmentsOutline"
            placeholder="Placeholder"
          />
          <Input
            leftIconName="MailSolid"
            rightText="Max"
            placeholder="Placeholder"
          />
          <Input
            rightIconName="QrcodeSolid"
            onPressRightIcon={onQrScan}
            rightSecondaryIconName="UserSolid"
            onPressSecondaryRightIcon={onUser}
            placeholder="Placeholder"
          />
          <Input
            rightText="ETH"
            rightSecondaryText="Max"
            onPressRightText={onQrScan}
            onPressSecondaryRightText={onUser}
            placeholder="Placeholder"
          />
          <Input
            small
            rightIconName="QrcodeSolid"
            onPressRightIcon={onQrScan}
            rightSecondaryIconName="UserSolid"
            onPressSecondaryRightIcon={onUser}
            placeholder="Placeholder"
            value="small"
          />
          <FormControl isInvalid>
            <FormControl.Label>Password</FormControl.Label>
            <Input placeholder="Enter password" />
            <FormControl.HelperText>
              Must be at least 6 characters.
            </FormControl.HelperText>
            <FormControl.ErrorMessage
              leftIcon={<Icon size={16} name="ExclamationCircleOutline" />}
            >
              Try different from previous passwords.
            </FormControl.ErrorMessage>
          </FormControl>
        </Stack>
      </ScrollView>
    </Center>
  );
};

export default InputGallery;
