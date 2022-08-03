import React, { useCallback, useState } from 'react';

import {
  Box,
  Center,
  Image,
  NetImage,
  Text,
  Typography,
} from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import {
  getImageWithAsset,
  s3SourceUri,
  syncImage,
} from '@onekeyhq/engine/src/managers/nftscan';

const asset = {
  'contractAddress': '0x538be2f351a6dac5d4f476cab364a007ee0a9924',
  'contractName': 'Vagina',
  'contractTokenId':
    '0x000000000000000000000000000000000000000000000000000000000000001c',
  'tokenId': '28',
  'ercType': 'erc721',
  'amount': '1',
  'minter': '0x32b059f37c885e1e74c90ca71d7dc14ad2f638d1',
  'owner': '0x32b059f37c885e1e74c90ca71d7dc14ad2f638d1',
  'mintTimestamp': 1655652624000,
  'mintTransactionHash':
    '0x1b998a8dd9076cf7fd0ed6a776e1a5470d9791fb363860e973815b902c8fd46d',
  'mintPrice': 0,
  'tokenUri':
    'https://dweb.link/ipfs/QmP9jrdxmsedXjJWgpoyAAcdEyMaEnchyXyX7szskrA2gY?28',
  'metadataJson':
    '{\n  "name": "PFE",\n  "description": "",\n  "image": "ipfs://QmTv2xFrRtSk7Bxagebr7QRq2bSqUf7Eb7a8TpoBFwsNgy",\n  "external_url": "https://pfe.com",\n  "attributes": [\n    {\n    }\n  ]\n}',
  'name': 'PFE',
  'contentType': 'unknown',
  'contentUri': 'QmTv2xFrRtSk7Bxagebr7QRq2bSqUf7Eb7a8TpoBFwsNgy',
  'imageUri': 'QmTv2xFrRtSk7Bxagebr7QRq2bSqUf7Eb7a8TpoBFwsNgy',
  'externalLink': 'https://pfe.com',
  'latestTradePrice': null,
  'latestTradeTimestamp': 1655652624000,
  'nftscanId': 'NSB853ADD0E91A7148',
  'nftscanUri': null,
  'attributes': null,
};

const TypographyGallery = () => {
  const [isUpload, setIsupload] = useState<boolean | null>(null);
  const url = s3SourceUri(asset.contractAddress, asset.contractTokenId, true);

  console.log(`url = ${url}key = ${isUpload}`);

  const uploadImage = useCallback(async () => {
    const uploadSource = getImageWithAsset(asset);
    if (uploadSource) {
      const uploadData = await syncImage({
        contractAddress: asset.contractAddress,
        tokenId: asset.contractTokenId,
        imageURI: uploadSource,
      });
      if (uploadData) {
        setIsupload(true);
      } else {
        setIsupload(false);
      }
    } else {
      setIsupload(false);
    }
  }, [asset]);

  return (
    <Center flex="1" bg="background-hovered">
      <NetImage
        key={isUpload}
        preview
        skeleton
        retry={3}
        width="500px"
        height="500px"
        borderRadius="50px"
        src={`${url}?t=${new Date().getTime()}`}
        onErrorWithTask={uploadImage}
        fallbackElement={
          <Center bgColor="amber.300" width={100} height={100} />
        }
      />
    </Center>
  );
};

export default TypographyGallery;
