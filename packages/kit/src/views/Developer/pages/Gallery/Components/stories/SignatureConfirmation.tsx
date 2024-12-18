import type { IYStackProps } from '@onekeyhq/components';
import { SizableText, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

// do not use this demo-only component
function FakeWrapper({ children, ...rest }: IYStackProps) {
  return (
    <YStack
      w={640}
      p="$5"
      borderWidth={1}
      borderColor="$borderSubdued"
      {...rest}
    >
      {children}
    </YStack>
  );
}

function YourComponentDemo() {
  return (
    <FakeWrapper>
      <SizableText>123</SizableText>
    </FakeWrapper>
  );
}

const SignatureConfirmationGallery = () => (
  <Layout
    description="Description of your component"
    suggestions={['Suggestion 1', 'Suggestion 2']}
    boundaryConditions={['Boundary condition 1']}
    elements={[
      {
        title: 'Default',
        element: <YourComponentDemo />,
      },
    ]}
  />
);

export default SignatureConfirmationGallery;
