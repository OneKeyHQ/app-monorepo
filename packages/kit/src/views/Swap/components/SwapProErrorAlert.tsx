import { Alert } from '@onekeyhq/components';

interface ISwapProErrorAlertProps {
  title?: string;
  message?: string;
}

const SwapProErrorAlert = ({ title, message }: ISwapProErrorAlertProps) => {
  if (!title && !message) {
    return null;
  }
  return (
    <Alert
      type="warning"
      title={title}
      icon="InfoCircleOutline"
      description={message}
    />
  );
};

export default SwapProErrorAlert;
