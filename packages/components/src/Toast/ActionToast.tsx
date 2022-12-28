import type { FC } from 'react';

import { useThemeValue } from '@onekeyhq/components';

import Box from '../Box';
import Button from '../Button';
import Text from '../Text';

import type { ThemeToken } from '../Provider/theme';
import type { BaseToastProps as RNBaseToastProps } from 'react-native-toast-message';

type ActionToastProps = {
  bgColorToken?: ThemeToken;
  borderColorToken?: ThemeToken;
  textColorToken?: ThemeToken;
  onPress?: () => void;
};

const ActionToast: FC<ActionToastProps & RNBaseToastProps> = ({
  bgColorToken,
  borderColorToken,
  textColorToken,
  text2,
  onPress,
  text1,
  ...props
}) => {
  const [bgColor, borderColor, textColor, buttonTextColor] = useThemeValue([
    bgColorToken || 'surface-default',
    borderColorToken || bgColorToken || 'border-default',
    textColorToken || 'text-default',
    'interactive-default',
  ]);

  return (
    <Box
      {...props}
      borderWidth="0.5px"
      borderRadius="12px"
      bg={bgColor}
      borderColor={borderColor}
      py="8px"
      px="12px"
      flexDirection="column"
    >
      <Text typography="Body1" color={textColor} numberOfLines={3}>
        {text1}
      </Text>
      <Button
        mb="4px"
        mt="4px"
        alignSelf="flex-end"
        type="plain"
        onPress={onPress}
      >
        <Text typography="Body1" color={buttonTextColor} numberOfLines={1}>
          {text2}
        </Text>
      </Button>
    </Box>
  );
};

export default ActionToast;
