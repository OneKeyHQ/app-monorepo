import {
  Box,
  Center,
  FlatList,
  Typography,
  useTheme,
} from '@onekeyhq/components';
import theme from '@onekeyhq/components/src/Provider/theme';

const ThemeGallery = () => {
  const { themeVariant } = useTheme();
  const themeVars = theme[themeVariant as 'light'];
  const list = Object.keys(themeVars).reduce<{ name: string; color: string }[]>(
    (memo, curr) => [
      ...memo,
      { name: curr, color: themeVars[curr as keyof typeof themeVars] },
    ],
    [],
  );

  return (
    <FlatList
      data={list}
      bg="background-hovered"
      keyExtractor={(item) => item.name}
      renderItem={({ item }) => (
        <Center flex="1" flexDirection="row" display="flex" my="2">
          <Center
            width="320px"
            flexDirection="row"
            display="flex"
            justifyContent="space-between"
          >
            <Box bg={item.color} width="8" height="8" rounded="2xl" />
            <Typography.Body2 flex="1" pl="2">
              {item.name}
            </Typography.Body2>
            <Typography.Body2 width="72px">{item.color}</Typography.Body2>
          </Center>
        </Center>
      )}
    />
  );
};

export default ThemeGallery;
