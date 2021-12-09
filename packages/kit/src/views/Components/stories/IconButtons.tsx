import React, { useState } from 'react';

import {
  Center,
  Text,
  IconButton,
  Switch,
  Stack,
  Select,
} from '@onekeyhq/components';

const IconButtons = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [disabled, setDisabled] = useState<boolean>(false);
  const [circle, setCircle] = useState<boolean>(false);
  const [type, setType] = useState<
    'primary' | 'basic' | 'plain' | 'destructive' | 'outline'
  >('primary');
  const [size, setSize] = useState<'base' | 'xs' | 'sm' | 'lg' | 'xl'>('base');
  return (
    <Center flex="1" bg="background-hovered">
      <Stack direction="row" space="2" mb="2" alignItems="center">
        <Select
          color="text-default"
          placeholder="select button type"
          selectedValue={type}
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
          color="text-default"
          placeholder="select button size"
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
          <Text color="white">disabled: </Text>
          <Switch
            isChecked={disabled}
            onToggle={() => setDisabled(!disabled)}
          />
        </Stack>
        <Stack direction="row">
          <Text color="white">circle: </Text>
          <Switch isChecked={circle} onToggle={() => setCircle(!circle)} />
        </Stack>
        <Stack direction="row">
          <Text color="white">loading: </Text>
          <Switch isChecked={loading} onToggle={() => setLoading(!loading)} />
        </Stack>
      </Stack>
      <IconButton
        type={type}
        size={size}
        circle={circle}
        isDisabled={disabled}
        isLoading={loading}
        name="AcademicCapSolid"
      />
    </Center>
  );
};

export default IconButtons;
