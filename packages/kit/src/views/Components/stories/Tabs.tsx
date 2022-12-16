import { Box, SceneMap, TabView, useThemeValue } from '@onekeyhq/components';

const FirstRoute = () => (
  <Box flex={1} bg={useThemeValue('background-default')} />
);
const SecondRoute = () => <Box flex={1} bg="red.100" />;

const TabsGallery = () => (
  <Box flex={1}>
    <TabView
      paddingX={16}
      autoWidth
      routes={[
        {
          key: 'hello',
          title: 'First',
        },
        {
          key: 'world',
          title: 'Tab2',
        },
        {
          key: 'qwe',
          title: 'Tab3',
        },
        {
          key: 'asd',
          title: 'Tab4',
        },
      ]}
      renderScene={SceneMap({
        hello: FirstRoute,
        world: SecondRoute,
        qwe: SecondRoute,
        asd: SecondRoute,
      })}
    />
  </Box>
);

export default TabsGallery;
