import { Center } from '@onekeyhq/components';

import NFTImage from '../../../components/NFTImage';

const NFTImageGallery = () => {
  // const { contractAddress, contractTokenId } = asset;
  // const s3Url = `https://dev.onekey-asset.com/${contractAddress}/${contractTokenId}/source`;

  const contractAddress = 'test_contractAddress_0';
  const contractTokenId = 'test_tokenId_89';
  const s3Url = `https://nft.onekey-asset.com/${contractAddress}/${contractTokenId}/source`;

  const uploadSource =
    'https://cloudflare-ipfs.com/ipfs/QmbmbDRHRexwpZm1QDcbtXyGH7TshwfrLXJRmoWiWvn8ey/6620.png';
  return (
    <Center flex="1" bg="background-hovered">
      <NFTImage
        s3Url={s3Url}
        nftSource={{
          contractAddress,
          tokenId: contractTokenId,
          url: uploadSource,
        }}
        skeleton
        retry={0}
        width="500px"
        height="500px"
        borderRadius="50px"
      />
    </Center>
  );
};

export default NFTImageGallery;
