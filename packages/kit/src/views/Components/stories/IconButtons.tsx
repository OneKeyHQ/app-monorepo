import { Center, IconButton, Stack } from '@onekeyhq/components';

const IconButtons = () => (
  <Center flex="1" bg="background-hovered">
    <Stack direction="row" space="2" mb="2" alignItems="center">
      <Stack direction="column" space="2" mb="2" alignItems="center">
        <IconButton
          isLoading
          type="primary"
          size="base"
          name="AcademicCapMini"
        />
        <IconButton
          isDisabled
          type="primary"
          size="base"
          name="AcademicCapMini"
        />
        <IconButton type="primary" size="base" name="AcademicCapMini" />
        <IconButton type="basic" size="base" name="AcademicCapMini" />
        <IconButton type="plain" size="base" name="AcademicCapMini" />
        <IconButton type="destructive" name="AcademicCapMini" />
        <IconButton type="outline" name="AcademicCapMini" />
      </Stack>
      <Stack direction="column" space="2" mb="2" alignItems="center">
        <IconButton isLoading type="primary" size="xs" name="AcademicCapMini" />
        <IconButton
          isDisabled
          type="primary"
          size="xs"
          name="AcademicCapMini"
        />
        <IconButton type="primary" size="xs" name="AcademicCapMini" />
        <IconButton type="basic" size="xs" name="AcademicCapMini" />
        <IconButton type="plain" size="xs" name="AcademicCapMini" />
        <IconButton type="destructive" size="xs" name="AcademicCapMini" />
        <IconButton type="outline" size="xs" name="AcademicCapMini" />
      </Stack>
      <Stack direction="column" space="2" mb="2" alignItems="center">
        <IconButton isLoading type="primary" size="xl" name="AcademicCapMini" />
        <IconButton
          isDisabled
          type="primary"
          size="xl"
          name="AcademicCapMini"
        />
        <IconButton type="primary" size="xl" name="AcademicCapMini" />
        <IconButton type="basic" size="xl" name="AcademicCapMini" />
        <IconButton type="plain" size="xl" name="AcademicCapMini" />
        <IconButton type="destructive" size="xl" name="AcademicCapMini" />
        <IconButton type="outline" size="xl" name="AcademicCapMini" />
      </Stack>
    </Stack>
  </Center>
);

export default IconButtons;
