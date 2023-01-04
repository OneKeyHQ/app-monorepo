import type { FC } from 'react';
import { memo } from 'react';

import {
  Box,
  Pressable,
  Token,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';

type TokenTagProps = {
  logoURI?: string;
  name?: string;
  onPress?: () => void;
};
const TokenTag: FC<TokenTagProps> = ({ name, logoURI, onPress }) => {
  const bgColorDefault = useThemeValue('surface-neutral-subdued');
  return (
    <Pressable mr="2" onPress={onPress} mb="2">
      {({ isPressed, isHovered }) => {
        let bgColor = bgColorDefault;
        if (isHovered) bgColor = 'surface-hovered';
        if (isPressed) bgColor = 'surface-pressed';
        return (
          <Box
            flexDirection="row"
            pl="1.5"
            pr="2.5"
            py="1.5"
            borderRadius="full"
            bgColor={bgColor}
          >
            {logoURI ? (
              <Token size={5} token={{ logoURI, name, symbol: name }} />
            ) : null}
            <Typography.Body2Strong ml="1">{name}</Typography.Body2Strong>
          </Box>
        );
      }}
    </Pressable>
  );
};

export default memo(TokenTag);
