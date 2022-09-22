import { FC } from 'react';

import { BaseToastProps as RNBaseToastProps } from 'react-native-toast-message';

import Box from '../Box';
import Button from '../Button';
import { useThemeValue } from '../Provider/hooks';
import { ThemeToken } from '../Provider/theme';
import { Text } from '../Typography';

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
