import { ToggleGroup as TMToggleGroup } from 'tamagui';

import { Icon } from '../Icon';
import { Stack } from '../Stack';
import { Text } from '../Text';

import type { ICON_NAMES } from '../Icon';
import type { GetProps } from 'tamagui';

export function ToggleGroup(props: GetProps<typeof TMToggleGroup>) {
  return <TMToggleGroup unstyled {...props} />;
}

function ToggleGroupItem(props: GetProps<typeof TMToggleGroup.Item>) {
  return (
    <TMToggleGroup.Item
      unstyled
      m="$-px"
      p="$2"
      bg="$bgSubdued"
      borderWidth="$px"
      borderColor="$borderStrong"
      hoverStyle={{
        bg: '$bgHover',
      }}
      focusStyle={{
        outlineColor: '$focusRing',
        outlineWidth: 2,
        outlineStyle: 'solid',
      }}
      {...props}
    />
  );
}

function ToggleGroupText(props: GetProps<typeof Text>) {
  return <Text variant="$bodyMdMedium" px="$1" {...props} />;
}

function ToggleGroupIcon({ name }: { name: ICON_NAMES }) {
  return (
    <Stack>
      <Icon size="$5" color="$iconSubdued" name={name} />
    </Stack>
  );
}

ToggleGroup.Item = ToggleGroupItem;
ToggleGroup.Icon = ToggleGroupIcon;
ToggleGroup.Text = ToggleGroupText;
