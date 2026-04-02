import type { IDisplayComponentDefault } from '@onekeyhq/shared/types/signatureConfirm';

import { SignatureConfirmItem } from '../SignatureConfirmItem';

type IProps = {
  component: IDisplayComponentDefault;
};
function Default(props: IProps) {
  const { component } = props;
  return (
    <SignatureConfirmItem>
      <SignatureConfirmItem.Label>{component.label}</SignatureConfirmItem.Label>
      <SignatureConfirmItem.Value>{component.value}</SignatureConfirmItem.Value>
    </SignatureConfirmItem>
  );
}

export { Default };
