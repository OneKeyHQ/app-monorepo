import { ToggleGroup as TMToggleGroup } from 'tamagui';

import { Text } from '../Text';

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

ToggleGroup.Item = ToggleGroupItem;
ToggleGroup.Text = ToggleGroupText;
