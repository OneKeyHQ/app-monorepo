import { Button, XStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

function setTheme(theme: string) {
  console.log(theme);
  // do nothing
}

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
            <Button
              onPress={() => {
                setTheme('light');
              }}
            >
              Light Theme
            </Button>
            <Button
              variant="primary"
              onPress={() => {
                setTheme('dark');
              }}
            >
              Night Theme
            </Button>
          </XStack>
        ),
      },
    ]}
  />
);

export default ThemeGallery;
