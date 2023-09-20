import { Box, ScrollView, Text } from '@onekeyhq/components';
import MnemonicCard from '@onekeyhq/components/src/MnemonicCard/MnemonicCard';

const word12 =
  'debris say skill blouse expire card monkey police taxi teach guard curious';
const word15 =
  'citizen lonely crazy plunge slight fee universe soldier will junior snow vault physical already harvest';
const word18 =
  'invite hello moment impact banner hotel process deer ripple rebel voice salute orient olympic sausage toilet hamster weekend';
const word21 =
  'badge ice cigar raccoon smooth solve letter mail upper sword spirit gate baby solution cherry casual alter total credit math shell';
const word24 =
  'drastic click milk forest aspect lecture right dose gas find pottery seat harvest clay casual attend omit slogan prize alley liar advice produce engine';

const MnemonicCardGallery = () => (
  <ScrollView p="20px">
    <Text typography={{ sm: 'DisplayLarge', md: 'DisplayMedium' }} mb="3">
      12 words
    </Text>
    <MnemonicCard mnemonic={word12} />
    <Box h="20px" />

    <Text typography={{ sm: 'DisplayLarge', md: 'DisplayMedium' }} mb="3">
      15 words
    </Text>
    <MnemonicCard mnemonic={word15} />
    <Box h="20px" />

    <Text typography={{ sm: 'DisplayLarge', md: 'DisplayMedium' }} mb="3">
      18 words
    </Text>
    <MnemonicCard mnemonic={word18} />
    <Box h="20px" />

    <Text typography={{ sm: 'DisplayLarge', md: 'DisplayMedium' }} mb="3">
      21 words
    </Text>
    <MnemonicCard mnemonic={word21} />
    <Box h="20px" />

    <Text typography={{ sm: 'DisplayLarge', md: 'DisplayMedium' }} mb="3">
      24 words
    </Text>
    <MnemonicCard mnemonic={word24} />
    <Box h="80px" />
  </ScrollView>
);

export default MnemonicCardGallery;
