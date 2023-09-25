import { Button, XStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ThemeGallery = () => (
  <Layout
    description="图标是一种视觉符号，用于表示对象或概念"
    suggestions={['图标的设计应该简洁、易于理解、易于识别']}
    boundaryConditions={[]}
    elements={[
      {
        title: 'Toggle Theme',
        element: (
          <XStack space={10}>
            <Button>
              <Button.Text>Light Theme</Button.Text>
            </Button>
            <Button buttonVariant="primary">
              <Button.Text>Night Theme</Button.Text>
            </Button>
          </XStack>
        ),
      },
    ]}
  />
);

export default ThemeGallery;
