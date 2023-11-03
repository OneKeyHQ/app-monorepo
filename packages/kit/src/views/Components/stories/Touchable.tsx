import { Text, Touchable } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const TouchableDemo = () => (
  <Touchable
    p="$10"
    bg="$borderLight"
    onPress={() => {
      alert('Hello');
    }}
  >
    <Text>Hello OneKey</Text>
  </Touchable>
);

const TouchableGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    scrollEnabled={false}
    elements={[
      {
        title: 'Styled Touchable',
        element: <TouchableDemo />,
      },
    ]}
  />
);

export default TouchableGallery;
