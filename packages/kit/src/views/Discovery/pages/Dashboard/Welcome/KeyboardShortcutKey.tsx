import { SizableText, Stack } from '@onekeyhq/components';

interface IKeyboardShortcutKeyProps {
  label: string;
}

export function KeyboardShortcutKey({ label }: IKeyboardShortcutKeyProps) {
  return (
    <Stack
      bg="$bgStrong"
      borderRadius="$1"
      px="$0.5"
      minWidth="$4"
      h="$4"
      alignItems="center"
      justifyContent="center"
    >
      <SizableText color="$textSubdued" size="$headingXs">
        {label}
      </SizableText>
    </Stack>
  );
}
