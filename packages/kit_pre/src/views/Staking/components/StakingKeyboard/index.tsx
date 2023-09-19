import { useMemo } from 'react';
import type { FC } from 'react';

import { useWindowDimensions } from 'react-native';

import { Box, Keyboard } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type StakingKeyboardProps = {
  text: string;
  onTextChange?: (text: string) => void;
};

export const StakingKeyboard: FC<StakingKeyboardProps> = ({
  text,
  onTextChange,
}) => {
  const { height } = useWindowDimensions();
  const patternMemo = useMemo(() => {
    const pattern = `^(0|([1-9][0-9]*))?\\.?([0-9]{1,18})?$`;
    return new RegExp(pattern);
  }, []);
  const shortScreen = height < 768;
  if (!platformEnv.isNative) {
    return null;
  }
  return (
    <Box mt="4">
      <Keyboard
        itemHeight={shortScreen ? '44px' : undefined}
        pattern={patternMemo}
        text={text}
        onTextChange={onTextChange}
      />
    </Box>
  );
};
