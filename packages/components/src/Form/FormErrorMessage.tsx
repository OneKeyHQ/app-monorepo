import Alert from '../Alert';
import Box from '../Box';
import Icon from '../Icon';
import Typography from '../Typography';

export function FormErrorMessage({
  message,
  isAlertStyle,
  type,
}: {
  message: string;
  isAlertStyle?: boolean;
  type?: React.ComponentProps<typeof Alert>['alertType'];
}) {
  if (!message) {
    return null;
  }

  if (isAlertStyle) {
    return (
      <Box>
        <Alert alertType={type ?? 'error'} title={message} />
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
