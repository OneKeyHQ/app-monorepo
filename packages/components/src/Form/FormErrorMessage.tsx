import Alert from '../Alert';
import Box from '../Box';
import Icon from '../Icon';
import Typography from '../Typography';

type Props = {
  isAlertStyle?: boolean;
  message?: string;
} & Partial<React.ComponentProps<typeof Alert>>;

export function FormErrorMessage(props: Props) {
  const { isAlertStyle, message, alertType, dismiss, ...rest } = props;

  if (!message) {
    return null;
  }

  if (isAlertStyle) {
    return (
      <Box>
        <Alert
          title={message}
          alertType={alertType ?? 'error'}
          dismiss={dismiss ?? false}
          {...rest}
        />
      </Box>
    );
  }

  return (
    <Box display="flex" flexDirection="row" mt="2">
      <Box mr="2">
        <Icon size={20} name="ExclamationTriangleMini" color="icon-critical" />
      </Box>
      <Typography.Body2 color="text-critical">{message}</Typography.Body2>
    </Box>
  );
}
