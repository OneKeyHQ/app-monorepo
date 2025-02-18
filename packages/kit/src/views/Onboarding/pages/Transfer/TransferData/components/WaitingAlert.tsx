import { Alert } from '@onekeyhq/components';

export function WaitingTransferCompleteAlert() {
  return (
    <Alert
      title="Waiting for the transfer to complete..."
      type="info"
      icon="LoaderOutline"
    />
  );
}
