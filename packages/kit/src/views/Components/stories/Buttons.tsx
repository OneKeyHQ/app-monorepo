import React, { useState } from 'react';

import {
  Button,
  Center,
  Select,
  Stack,
  Switch,
  Typography,
} from '@onekeyhq/components';

const Buttons = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [disabled, setDisabled] = useState<boolean>(false);
  const [type, setType] = useState<
    'primary' | 'basic' | 'plain' | 'destructive' | 'outline'
  >('primary');
  const [size, setSize] = useState<'base' | 'xs' | 'sm' | 'lg' | 'xl'>('base');
  console.log('loading', loading);
  return (
    <Center flex="1" bg="background-hovered">
      <Stack direction="row" space="2" mb="2" alignItems="center">
        <Select
          placeholder="Select Button Type"
          selectedValue={type}
          color="text-default"
          mx={{
            base: 0,
            md: 'auto',
          }}
          onValueChange={(nextValue) =>
            setType(
              nextValue as
                | 'primary'
                | 'basic'
                | 'plain'
                | 'destructive'
                | 'outline',
            )
          }
          accessibilityLabel="Select a Button Type"
        >
          <Select.Item label="Primary" value="primary" />
          <Select.Item label="Basic" value="basic" />
          <Select.Item label="Plain" value="plain" />
          <Select.Item label="Destructive" value="destructive" />
          <Select.Item label="Outline" value="outline" />
        </Select>
        <Select
          placeholder="Select Button Size"
          color="text-default"
          selectedValue={size}
          mx={{
            base: 0,
            md: 'auto',
          }}
          onValueChange={(nextValue) =>
            setSize(nextValue as 'base' | 'xs' | 'sm' | 'lg' | 'xl')
          }
          accessibilityLabel="Select a Button Type"
        >
          <Select.Item label="base" value="base" />
          <Select.Item label="xs" value="xs" />
          <Select.Item label="sm" value="sm" />
          <Select.Item label="lg" value="lg" />
          <Select.Item label="xl" value="xl" />
        </Select>
        <Stack direction="row">
          <Typography.Body2 color="white">disabled: </Typography.Body2>
          <Switch
            isChecked={disabled}
            onToggle={() => setDisabled(!disabled)}
          />
        </Stack>
        <Stack direction="row">
          <Typography.Body2 color="white">loading: </Typography.Body2>
          <Switch isChecked={loading} onToggle={() => setLoading(!loading)} />
        </Stack>
      </Stack>
      <Button
        type={type}
        size={size}
        isDisabled={disabled}
        isLoading={loading}
        rightIconName="AcademicCapSolid"
        leftIconName="BrandLogoIllus"
      >
        Button
      </Button>
    </Center>
  );
};

export default Buttons;
