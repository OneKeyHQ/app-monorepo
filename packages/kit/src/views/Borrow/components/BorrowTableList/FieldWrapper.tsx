import { YStack } from '@onekeyhq/components';

type IFieldWrapperProps = {
  children: React.ReactNode;
} & React.ComponentProps<typeof YStack>;

export const FieldWrapper = ({ children, ...rest }: IFieldWrapperProps) => {
  return (
    <YStack gap="$1" minHeight="$8" w="100%" jc="center" {...rest}>
      {children}
    </YStack>
  );
};
