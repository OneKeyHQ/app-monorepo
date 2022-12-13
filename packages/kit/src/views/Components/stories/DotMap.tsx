import { StackNavigationProp } from '@react-navigation/stack';

import { Box, Button, ScrollView } from '@onekeyhq/components';

import { useNavigation } from '../../../hooks';
import {
  ModalScreenProps,
  RootRoutes,
  RootRoutesParams,
} from '../../../routes/types';
import { KeyTagMatrix } from '../../KeyTag/Component/KeyTagMatrix/KeyTagMatrix';
import { mnemonicWordsToKeyTagMnemonic } from '../../KeyTag/utils';

type NavigationProps = ModalScreenProps<RootRoutesParams>;

// const fakeData =
//   'idle bench tomato ankle desk thunder snack oil butter view infant image';
const fakeData =
  'birth buyer maple betray miss junk assume citizen agent toward hurdle jacket awful crater ball harbor spin basic';

const DotMapGallery = () => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  return (
    <ScrollView>
      <Box ml={50} mt={10}>
        <KeyTagMatrix keyTagData={mnemonicWordsToKeyTagMnemonic(fakeData)} />
      </Box>
      <Box mt={10}>
        <Button
          onPress={() => {
            navigation.replace(RootRoutes.KeyTag);
          }}
        >
          on keytag
        </Button>
      </Box>
    </ScrollView>
  );
};

export default DotMapGallery;
