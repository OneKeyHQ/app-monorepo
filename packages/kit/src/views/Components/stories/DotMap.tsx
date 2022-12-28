import { Box, Button, ScrollView } from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { HomeRoutes, RootRoutes } from '../../../routes/types';

const DotMapGallery = () => {
  const navigation = useAppNavigation();
  // const navigation = useNavigation<NavigationProps['navigation']>();
  return (
    <ScrollView>
      <Box mt={10}>
        <Button
          onPress={() => {
            navigation.navigate(RootRoutes.Root, { screen: HomeRoutes.KeyTag });
          }}
        >
          on keytag
        </Button>
      </Box>
    </ScrollView>
  );
};

export default DotMapGallery;
