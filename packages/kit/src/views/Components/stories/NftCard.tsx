import {
  Badge,
  HStack,
  Icon,
  NftCard,
  ScrollView,
  Typography,
  VStack,
} from '@onekeyhq/components';

const NftCardGallery = () => (
  <ScrollView bg="background-hovered" flex="1">
    <VStack space={3} w="100%" p={4}>
      <HStack alignItems="center" justifyContent="space-between">
        <Typography.Heading>Collectibles</Typography.Heading>
        <Icon name="AcademicCapOutline" />
      </HStack>
      <HStack space={3} alignItems="center">
        <Typography.Subheading color="text-subdued">
          ENS: Ethereum Name Service
        </Typography.Subheading>
        <Badge type="default" title="2" size="sm" />
      </HStack>
      <HStack
        flexWrap="wrap"
        space={0}
        alignItems="center"
        justifyContent={['space-between', 'initial']}
      >
        <NftCard
          image="https://storage.opensea.io/files/d097e6b6061673ed712a9227629ca6fb.svg"
          title="amagii.eth"
          w={['45%', '177px']}
          minW={['auto', '177px']}
          maxH="222px"
          mb={4}
          mr={[0, 4]}
        />
        <NftCard
          image="https://lh3.googleusercontent.com/DEpVCJoqPbjEVrbWytmYRYZfVptsWl9MW9eZcwupufUH7il2kIYTyMrNFEbmFNOh1Gl_RaFkTYBbcupXkzqLkAMkFQxTu_iA_ztj=s550"
          title="Glacial River from Above #5"
          w={['45%', 'auto']}
          minW={['auto', '177px']}
          maxW={['auto', '177px']}
          maxH="222px"
          mb={4}
          mr={[0, 4]}
        />
        <NftCard
          image="https://storage.opensea.io/static/promocards/restless-promocard.jpeg"
          title="restless by kingurantatata"
          w={['45%', 'auto']}
          minW={['auto', '177px']}
          maxW={['auto', '177px']}
          maxH="222px"
          mb={4}
          mr={[0, 4]}
        />
        <NftCard
          image="https://storage.opensea.io/static/promocards/sturec-promocard.png"
          title="Conflict tcilfnoC"
          w={['45%', 'auto']}
          minW={['auto', '177px']}
          maxW={['auto', '177px']}
          maxH="222px"
          mb={4}
          mr={[0, 4]}
        />
        <NftCard
          image="https://storage.opensea.io/static/promocards/theweeknd-promocard.png"
          title="The Weeknd’s “Blinding Lights”"
          w={['45%', 'auto']}
          minW={['auto', '177px']}
          maxW={['auto', '177px']}
          maxH="222px"
          mb={4}
          mr={[0, 4]}
        />
      </HStack>
    </VStack>
  </ScrollView>
);

export default NftCardGallery;
