import React from 'react';

import { Center, IconButton, Stack } from '@onekeyhq/components';

const IconButtons = () => (
  <Center flex="1" bg="background-hovered">
    <Stack direction="row" space="2" mb="2" alignItems="center">
      <Stack direction="column" space="2" mb="2" alignItems="center">
        <IconButton
          isLoading
          type="primary"
          size="base"
          name="AcademicCapSolid"
        />
        <IconButton
          isDisabled
          type="primary"
          size="base"
          name="AcademicCapSolid"
        />
        <IconButton type="primary" size="base" name="AcademicCapSolid" />
        <IconButton type="basic" size="base" name="AcademicCapSolid" />
        <IconButton type="plain" size="base" name="AcademicCapSolid" />
        <IconButton type="destructive" name="AcademicCapSolid" />
        <IconButton type="outline" name="AcademicCapSolid" />
      </Stack>
      <Stack direction="column" space="2" mb="2" alignItems="center">
        <IconButton
          isLoading
          type="primary"
          size="xs"
          name="AcademicCapSolid"
        />
        <IconButton
          isDisabled
          type="primary"
          size="xs"
          name="AcademicCapSolid"
        />
        <IconButton type="primary" size="xs" name="AcademicCapSolid" />
        <IconButton type="basic" size="xs" name="AcademicCapSolid" />
        <IconButton type="plain" size="xs" name="AcademicCapSolid" />
        <IconButton type="destructive" size="xs" name="AcademicCapSolid" />
        <IconButton type="outline" size="xs" name="AcademicCapSolid" />
      </Stack>
      <Stack direction="column" space="2" mb="2" alignItems="center">
        <IconButton
          isLoading
          type="primary"
          size="xl"
          name="AcademicCapSolid"
        />
        <IconButton
          isDisabled
          type="primary"
          size="xl"
          name="AcademicCapSolid"
        />
        <IconButton type="primary" size="xl" name="AcademicCapSolid" />
        <IconButton type="basic" size="xl" name="AcademicCapSolid" />
        <IconButton type="plain" size="xl" name="AcademicCapSolid" />
        <IconButton type="destructive" size="xl" name="AcademicCapSolid" />
        <IconButton type="outline" size="xl" name="AcademicCapSolid" />
      </Stack>
    </Stack>
  </Center>
);

export default IconButtons;
