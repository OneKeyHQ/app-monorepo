import {
  LinearGradient,
  SizableText,
  Stack,
  useTheme,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const LinearGradientGallery = () => {
  const theme = useTheme();
  const bgActiveColor = theme.bgActive.val;
  const backgroundHoverColor = theme.backgroundHover.val;
  const bgPrimaryColor = theme.bgPrimary.val;
  return (
    <Layout
      getFilePath={() => __CURRENT_FILE_PATH__}
      componentName="LinearGradient"
      elements={[
        {
          title: 'default',
          element: (
            <Stack gap="$8">
              <LinearGradient
                // Button Linear Gradient
                colors={['#4c669f', '#3b5998', '#192f6a']}
                height="$24"
                width="100%"
                justifyContent="center"
              >
                <SizableText size="$bodyMd" color="#fff" textAlign="center">
                  Sign in
                </SizableText>
              </LinearGradient>
              <LinearGradient
                // Button Linear Gradient
                colors={[bgActiveColor, backgroundHoverColor, bgPrimaryColor]}
                height="$24"
                width="100%"
                justifyContent="center"
              >
                <SizableText size="$bodyMd" color="#fff" textAlign="center">
                  Sign in
                </SizableText>
              </LinearGradient>
            </Stack>
          ),
        },
      ]}
    />
  );
};

export default LinearGradientGallery;
