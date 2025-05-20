import { Button } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';

export interface IConnectWalletButtonProps extends IButtonProps {
  onConnect?: () => void;
}

export function ConnectWalletButton({
  onConnect,
  ...props
}: IConnectWalletButtonProps) {
  return (
    <Button variant="primary" size="large" {...props} onPress={onConnect}>
      Connect Wallet
    </Button>
  );
}
