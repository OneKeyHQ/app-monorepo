import { StackNavigationProp } from '@react-navigation/stack';

import { Box, Button, ScrollView } from '@onekeyhq/components';

import { useNavigation } from '../../../hooks';
import { HomeRoutes, HomeRoutesParams } from '../../../routes/types';
import { KeyTagMatrix } from '../../KeyTag/Component/KeyTagMatrix/KeyTagMatrix';
import { mnemonicWordsToKeyTagMnemonic } from '../../KeyTag/utils';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { KeyTagRoutes } from '../../KeyTag/Routes/enums';
import { IKeytagRoutesParams } from '../../KeyTag/Routes/types';

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams> &
  StackNavigationProp<IKeytagRoutesParams>;

// const fakeData =
//   'idle bench tomato ankle desk thunder snack oil butter view infant image';
const fakeData =
  'birth buyer maple betray miss junk assume citizen agent toward hurdle jacket awful crater ball harbor spin basic';

const DotMapGallery = () => {
  const navigation = useNavigation<NavigationProps>();
  return (
    <ScrollView>
      <Box ml={50} mt={10}>
        <KeyTagMatrix keyTagData={mnemonicWordsToKeyTagMnemonic(fakeData)} />
      </Box>
      <Box mt={10}>
        <Button
          onPress={() => {
            navigation.navigate(HomeRoutes.ShowDotMap, {
              mnemonicWords: fakeData,
            });
          }}
        >
          to page
        </Button>
        <Button
          onPress={() => {
            navigation.navigate(HomeRoutes.ImportKeyTag);
          }}
        >
          to page import
        </Button>
        <Button
          onPress={() => {
            navigation.replace(KeyTagRoutes.StartedKeytag);
          }}
        >
          to page import
        </Button>
      </Box>
    </ScrollView>
  );
};

export default DotMapGallery;
