import React from 'react';

import { Button, Center, Stack } from '@onekeyhq/components';

const Buttons = () => (
  <Center flex="1" bg="background-hovered">
    <Stack direction="row" space="2" mb="2" alignItems="center">
      <Stack direction="column" space="2" mb="2" alignItems="center">
        <Button
          isLoading
          type="primary"
          size="base"
          rightIconName="AcademicCapSolid"
        >
          Button
        </Button>
        <Button
          isDisabled
          type="primary"
          size="base"
          rightIconName="AcademicCapSolid"
        >
          Button
        </Button>
        <Button type="primary" size="base" leftIconName="AcademicCapSolid">
          Button
        </Button>
        <Button type="basic" size="base" rightIconName="AcademicCapSolid">
          Button
        </Button>
        <Button type="plain" size="base" rightIconName="AcademicCapSolid">
          Button
        </Button>
        <Button type="destructive" rightIconName="AcademicCapSolid">
          Button
        </Button>
        <Button type="outline" rightIconName="AcademicCapSolid">
          Button
        </Button>
      </Stack>
      <Stack direction="column" space="2" mb="2" alignItems="center">
        <Button
          isLoading
          type="primary"
          size="xs"
          rightIconName="AcademicCapSolid"
        >
          Button
        </Button>
        <Button
          isDisabled
          type="primary"
          size="xs"
          rightIconName="AcademicCapSolid"
        >
          Button
        </Button>
        <Button type="primary" size="xs" leftIconName="AcademicCapSolid">
          Button
        </Button>
        <Button type="basic" size="xs" rightIconName="AcademicCapSolid">
          Button
        </Button>
        <Button type="plain" size="xs" rightIconName="AcademicCapSolid">
          Button
        </Button>
        <Button type="destructive" size="xs" rightIconName="AcademicCapSolid">
          Button
        </Button>
        <Button type="outline" size="xs" rightIconName="AcademicCapSolid">
          Button
        </Button>
      </Stack>
      <Stack direction="column" space="2" mb="2" alignItems="center">
        <Button
          isLoading
          type="primary"
          size="xl"
          rightIconName="AcademicCapSolid"
        >
          Button
        </Button>
        <Button
          isDisabled
          type="primary"
          size="xl"
          rightIconName="AcademicCapSolid"
        >
          Button
        </Button>
        <Button type="primary" size="xl" leftIconName="AcademicCapSolid">
          Button
        </Button>
        <Button type="basic" size="xl" rightIconName="AcademicCapSolid">
          Button
        </Button>
        <Button type="plain" size="xl" rightIconName="AcademicCapSolid">
          Button
        </Button>
        <Button type="destructive" size="xl" rightIconName="AcademicCapSolid">
          Button
        </Button>
        <Button type="outline" size="xl" rightIconName="AcademicCapSolid">
          Button
        </Button>
      </Stack>
    </Stack>
  </Center>
);

export default Buttons;
