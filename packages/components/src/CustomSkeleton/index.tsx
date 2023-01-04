import type { ComponentProps, FC } from 'react';

import ContentLoader from 'react-content-loader/native';
import { Rect } from 'react-native-svg';

import { useThemeValue } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../Box';

const CustomSkeleton: FC<ComponentProps<typeof Box>> = ({ ...rest }) => {
  const backgroundColor = useThemeValue('surface-neutral-default');
  const foregroundColor = useThemeValue('surface-default');
  return (
    <Box overflow="hidden" {...rest}>
      <ContentLoader
        speed={1}
        width={platformEnv.isNative ? undefined : '100%'}
        height={platformEnv.isNative ? undefined : '100%'}
        backgroundColor={backgroundColor}
        foregroundColor={foregroundColor}
      >
        <Rect x="0" y="0" width="100%" height="100%" />
      </ContentLoader>
    </Box>
  );
};
export default CustomSkeleton;
