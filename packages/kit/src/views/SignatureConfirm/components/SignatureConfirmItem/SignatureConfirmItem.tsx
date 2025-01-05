import type { ISizableTextProps, IYStackProps } from '@onekeyhq/components';
import { SizableText, YStack } from '@onekeyhq/components';

function SignatureConfirmItemLabel(props: ISizableTextProps) {
  return <SizableText size="$bodyMd" color="$textSubdued" {...props} />;
}

function SignatureConfirmItemValue(props: ISizableTextProps) {
  return <SizableText size="$bodyMd" {...props} />;
}

type ISignatureConfirmItemType = IYStackProps;

function SignatureConfirmItem(props: ISignatureConfirmItemType) {
  return <YStack gap="$1" {...props} />;
}

SignatureConfirmItem.Label = SignatureConfirmItemLabel;
SignatureConfirmItem.Value = SignatureConfirmItemValue;

export { SignatureConfirmItem };
