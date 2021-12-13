import React, { useCallback } from 'react';
import { Center, Input, Stack, FormControl, Icon } from '@onekeyhq/components';

const InputGallery = () => {
  const onQrScan = useCallback(() => {
    console.log('onQrScan');
  }, []);
  const onUser = useCallback(() => {
    console.log('onUser');
  }, []);
  return (
    <Center flex="1" bg="background-hovered">
      <Stack space="2">
        <Input placeholder="Placeholder" />
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
          small
          rightIconName="QrcodeSolid"
          onPressRightIcon={onQrScan}
          rightSecondaryIconName="UserSolid"
          onPressSecondaryRightIcon={onUser}
          placeholder="Placeholder"
          value="small"
        />
        <FormControl
          isInvalid
          w={{
            base: '75%',
            md: '25%',
          }}
        >
          <FormControl.Label>Password</FormControl.Label>
          <Input placeholder="Enter password" />
          <FormControl.ErrorMessage
            leftIcon={<Icon name="AdjustmentsOutline" />}
          >
            Try different from previous passwords.
          </FormControl.ErrorMessage>
        </FormControl>
      </Stack>
    </Center>
  );
};

export default InputGallery;
