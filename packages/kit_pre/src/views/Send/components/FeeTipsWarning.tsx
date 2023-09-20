import { Typography } from '@onekeyhq/components';

export function FeeTipsWarning({ message }: { message: string }) {
  if (!message) {
    return null;
  }
  return (
    <Typography.Caption color="text-warning">{message}</Typography.Caption>
  );
}
