import type { FC } from 'react';
import { useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { Box, Icon, Typography, useThemeValue } from '@onekeyhq/components';

import type { SwapTooltipProps } from './types';

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 4,
  },
});

const SwapTooltip: FC<SwapTooltipProps> = ({ label }) => {
  const borderTopColor = useThemeValue('surface-neutral-default');
  const [visible, setVisible] = useState(false);
  return (
    <Box position="relative">
      <View
        style={styles.button}
        onStartShouldSetResponder={() => true}
        onResponderGrant={() => {
          setVisible(true);
        }}
        onResponderEnd={() => setVisible(false)}
      >
        <Icon color="text-subdued" name="QuestionMarkCircleOutline" size={16} />
      </View>
      {visible ? (
        <Box
          position="absolute"
          zIndex={1}
          bottom="7"
          left="-16px"
          bg="surface-neutral-default"
          borderRadius={12}
          width="56"
        >
          <Box
            style={{
              width: 0,
              height: 0,
              backgroundColor: 'transparent',
              borderStyle: 'solid',
              borderLeftWidth: 5,
              borderRightWidth: 5,
              borderTopWidth: 10,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor,
              position: 'absolute',
              bottom: -10,
              left: 22,
              maxWidth: 210,
            }}
          />
          <Box p="3">
            <Typography.Body2>{label}</Typography.Body2>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
};

export default SwapTooltip;
