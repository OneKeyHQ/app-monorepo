import { StyleSheet } from 'react-native';

import { ESwitchSize, Switch } from '../../forms/Switch';
import { SizableText, XStack } from '../../primitives';

/**
 * The preference capsule, the stage's ratified grammar for a choice that
 * rides a step's single exit: a full-pill container on $neutral2 under a
 * $neutral4 hairline, subdued label riding the wider start padding,
 * small switch tight to the end. Worn by the passphrase form's
 * Keep-wallet row and the hidden-wallet intro's shortcut row — one
 * owner, so the pill can never drift between them.
 */
export function PreferenceCapsule({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}) {
  return (
    <XStack
      alignItems="center"
      gap="$5"
      pl="$6"
      pr="$4"
      py="$3"
      borderRadius="$full"
      bg="$neutral2"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral4"
    >
      <SizableText flex={1} size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <Switch
        testID={testID}
        size={ESwitchSize.small}
        value={value}
        onChange={onChange}
      />
    </XStack>
  );
}
