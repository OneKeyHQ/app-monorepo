import { Alert } from '@onekeyhq/components';

export function UnsupportedSwapWarning() {
  return (
    <Alert
      icon="InfoCircleOutline"
      title="Swap Unsupported"
      type="warning"
      description="Current network doesn't support swaps. Switch network or wallet."
    />
  );
}
