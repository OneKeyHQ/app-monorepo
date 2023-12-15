import { LinearGradient, SizableText } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const LinearGradientGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'default',
        element: (
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
        ),
      },
    ]}
  />
);

export default LinearGradientGallery;
