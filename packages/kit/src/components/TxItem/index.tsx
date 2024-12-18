import type { IXStackProps, IYStackProps } from '@onekeyhq/components';
import { SizableText, XStack, YStack } from '@onekeyhq/components';

type ITxItemTextProsp = IXStackProps & {
  label?: string;
};

type ITxItemProps = IYStackProps & {
  label?: string;
  value?: string;
};

export function TxItem({ children, label, value, ...rest }: ITxItemProps) {
  return (
    <YStack {...rest}>
      <XStack>
        <SizableText>{label}</SizableText>
      </XStack>
      <SizableText>{value}</SizableText>
    </YStack>
  );
}
