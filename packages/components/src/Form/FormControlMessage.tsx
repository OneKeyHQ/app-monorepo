import type { FC } from 'react';

import Box from '../Box';
import Icon from '../Icon';
import Typography from '../Typography';

import type { ICON_NAMES } from '../Icon';
import type { ThemeToken } from '../Provider/theme';

type FormControlMessageProps = {
  message?: string;
  type?: 'error' | 'success' | 'warning';
};

const FormControlMessagePropsDefaultProps = {
  type: 'error',
} as const;

const FormControlMessage: FC<FormControlMessageProps> = ({ message, type }) => {
  const [iconName, iconColor, textColor]: [ICON_NAMES, ThemeToken, ThemeToken] =
    // eslint-disable-next-line no-nested-ternary
    type === 'error'
      ? ['ExclamationTriangleMini', 'icon-critical', 'text-critical']
      : type === 'warning'
      ? ['ExclamationTriangleMini', 'icon-warning', 'text-warning']
      : ['CheckCircleMini', 'icon-success', 'text-success'];

  if (!message) {
    return null;
  }
  return (
    <Box display="flex" flexDirection="row" mt="2">
      <Box mr="2">
        <Icon size={20} name={iconName} color={iconColor} />
      </Box>
      <Typography.Body2 flex={1} color={textColor}>
        {message}
      </Typography.Body2>
    </Box>
  );
};

FormControlMessage.defaultProps = FormControlMessagePropsDefaultProps;
export { FormControlMessage };
