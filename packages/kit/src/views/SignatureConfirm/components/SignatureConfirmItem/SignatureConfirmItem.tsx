import { StyleSheet } from 'react-native';

import type {
  ISizableTextProps,
  IStackProps,
  IYStackProps,
} from '@onekeyhq/components';
import { SizableText, Stack, YStack } from '@onekeyhq/components';

function SignatureConfirmItemLabel(props: ISizableTextProps) {
  return <SizableText size="$bodyMd" color="$textSubdued" {...props} />;
}

function SignatureConfirmItemValue(props: ISizableTextProps) {
  return <SizableText size="$bodyMd" {...props} />;
}

function SignatureConfirmItemBlock(props: IStackProps) {
  return (
    <Stack
      px="$3"
      py="$2"
      borderRadius="$2"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      {...props}
    />
  );
}

type ISignatureConfirmItemType = IYStackProps & {
  compact?: boolean;
};

function SignatureConfirmItem(props: ISignatureConfirmItemType) {
  const { compact, ...rest } = props;
  return (
    <YStack
      gap="$1"
      {...(compact && {
        flexBasis: '50%',
      })}
      {...rest}
    />
  );
}

SignatureConfirmItem.Label = SignatureConfirmItemLabel;
SignatureConfirmItem.Value = SignatureConfirmItemValue;
SignatureConfirmItem.Block = SignatureConfirmItemBlock;

export { SignatureConfirmItem };
