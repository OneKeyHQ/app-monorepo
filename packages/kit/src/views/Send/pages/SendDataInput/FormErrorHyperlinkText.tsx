import type { IErrorMessageComponentProps } from '@onekeyhq/components';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';

export function FormErrorHyperlinkText({
  translationId,
  ...props
}: IErrorMessageComponentProps) {
  return <HyperlinkText id={translationId} {...props} />;
}
