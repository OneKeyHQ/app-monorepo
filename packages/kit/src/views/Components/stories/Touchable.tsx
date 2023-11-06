import { Text, Touchable } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const TouchableDemo = () => (
  <Touchable
    padding="$10"
    backgroundColor="$borderLight"
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
