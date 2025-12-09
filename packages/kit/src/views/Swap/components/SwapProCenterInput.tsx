import { Input, SizableText, YStack } from '@onekeyhq/components';

interface ISwapProCenterInputProps {
  title: string;
  value: string;
  inputDisabled: boolean;
  onChangeText: (text: string) => void;
}

const SwapProCenterInput = ({
  title,
  value,
  onChangeText,
  inputDisabled,
}: ISwapProCenterInputProps) => {
  return (
    <YStack
      borderRadius="$2"
      bg="$bgStrong"
      px="$1"
      py="$0.5"
      alignItems="center"
    >
      <SizableText size="$bodySm" color="$textDisabled">
        {title}
      </SizableText>
      <Input
        value={value}
        readonly={inputDisabled}
        onChangeText={onChangeText}
        placeholder="Value"
        textAlign="center"
        keyboardType="decimal-pad"
        size="small"
        containerProps={{
          borderWidth: 0,
        }}
      />
    </YStack>
  );
};

export default SwapProCenterInput;
