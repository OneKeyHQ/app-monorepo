import { Icon, Image, Skeleton, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const base64Image =
  '\ndata:image/png;base64,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\n';

const images1 = [
  // 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  // 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  // 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
  // 'https://ipfs.io/ipfs/QmQr3Fz4h1etNsF7oLGMRHiCzhB5y9a7GjyodnF7zLHK1g',
  // 'https://static.jup.ag/jlp/icon.png',
  // 'https://static.jup.ag/jup/icon.png',
  // 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
  // 'https://arweave.net/BW67hICaKGd2_wamSB0IQq-x7Xwtmr2oJj1WnWGJRHU',
  // 'https://dd.dexscreener.com/ds-data/tokens/solana/E5e4J9ghU7YKu6GU2Ruh2HZLQiU3sfYourXZjKuubonk.png?size=lg&key=ced2c4',
  // 'https://file.dexlab.space/file/6478a6448b0b42639389b8a5f101c008',
  // 'https://ipfs.io/ipfs/QmRtFJu3ZospaS4EAk17iNXZGAJp7gMxzvsZckZxbqZa5r',
  // 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png',
  // 'https://ipfs.io/ipfs/QmZ7L8yd5j36oXXydUiYFiFsRHbi3EdgC4RuFwvM7dcqge',
  // 'https://ipfs.io/ipfs/bafkreibyb3hcn7gglvdqpmklfev3fut3eqv3kje54l3to3xzxxbgpt5wjm',
  // 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh/logo.png',
  // 'https://static-create.jup.ag/images/BFgdzMkTPdKKJeTipv2njtDEwhKxkgFueJQfJGt1jups',
  // 'https://storage.googleapis.com/token-metadata/JitoSOL-256.png',
  // 'https://gateway.irys.xyz/TD5zf8kAWTrlixpK52FmGZ1AitxFPabBLjUti6c92jo',
  // 'https://ipfs.io/ipfs/bafkreihsdoqkmpr5ryebaduoutyhj3nxco6wdp4s4743l2qrae4sz4hqrm',
  // 'https://dd.dexscreener.com/ds-data/tokens/solana/8AKBy6SkaerTMWZAad47yQxZnvrEk59DvhcHLHUsbonk.png?size=lg&key=2ea3e5',
];

const images2 = [
  // 'https://ipfs.io/ipfs/bafybeibfvyen3gwuageint4i52henuddfc27wlh6sdmmw2xx3l6smynjoq',
  // null,
  // null,
  // 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png',
  // null,
  // 'https://pump.mypinata.cloud/ipfs/QmWV8QgmH1gSw41yapzsFwkC8yPbzoSreAcJbzqfvo2sVq',
  // 'https://dd.dexscreener.com/ds-data/tokens/solana/3fAWpEPyf5FYTKfZuGrfwAXfuCpLKs2EVD2dUbzCbonk.png?size=lg&key=a8a7aa',
  // null,
  // null,
  'https://popcatsol.com/img/logo.png',
  'https://metadata.pumplify.eu/data/QmcySU6ivhADkMmUofy4qzHWdMsqt7cUkZ6v8jYnRvgmEM',
  'https://cdn.debridge.foundation/images/DBR.svg',
  // 'https://ipfs.io/ipfs/bafybeic356prb3behkqhrnrf6i4kpkwkuj2lg2vifrfccymms4jdn7t3ja',
  // null,
  // 'https://ipfs.io/ipfs/QmRgjRkuvQ8au7rKyp1i1DkvVukbUaQMsy5YYaSNrA9rvM',
  // 'https://bafkreiflz2xxkfn33qjch2wj55bvbn33q3s4mmb6bye5pt3mpgy4t2wg4e.ipfs.nftstorage.link/',
  // 'https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link',
  // null,
  // 'https://ipfs.io/ipfs/bafkreiamxjnqpbwtpqdfojiiq6qqtgk6jffc2yicumgwctp2ced3w6kkoi',
  // 'https://ipfs.io/ipfs/bafkreihcmho3e7yxzehcfa4onpjccnrny3tneujkehelihgzghxnbobnr4',
];

const ImageGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="Image"
    elements={[
      {
        title: 'load Image via source',
        element: (
          <YStack gap={10}>
            <Image
              height="$10"
              width="$10"
              source={require('@onekeyhq/kit/assets/walletLogo/cosmos_keplr.png')}
            />
            <Image
              height="$10"
              width="$10"
              source={{
                uri: 'https://uni.onekey-asset.com/static/chain/btc.png',
              }}
            />
          </YStack>
        ),
      },
      {
        title: 'load Image via src',
        element: (
          <YStack gap={10}>
            <Image
              height="$10"
              width="$10"
              src="https://uni.onekey-asset.com/static/chain/btc.png"
            />
          </YStack>
        ),
      },
      {
        title: 'uri is empty string',
        element: (
          <YStack gap={10}>
            <Image w="$5" h="$5" source={{ uri: '' }} />
          </YStack>
        ),
      },
      {
        title: 'base64 Image',
        element: (
          <YStack gap={10}>
            <Image w="$10" h="$10" source={{ uri: base64Image }} />
          </YStack>
        ),
      },
      {
        title: 'Loading Fallback',
        element: (
          <YStack gap={10}>
            <Image
              w="$10"
              h="$10"
              source={{
                uri: 'https://uni.onekey-asset.com/static/chain/btc.png',
              }}
            />

            <Image
              w="$10"
              h="$10"
              source={{
                uri: 'https://uni.onekey-asset.com/static/chain/btc.pn',
              }}
              fallback={<Icon name="ImageMountainsOutline" size="$8" />}
            />

            <Image
              w="$10"
              h="$10"
              source={{
                uri: 'https://uni.onekey-asset.com/static/chain/btc.pn',
              }}
            />
          </YStack>
        ),
      },
      {
        title: 'Loading Fallback',
        element: (
          <YStack gap="$4">
            <Image
              size="$10"
              source={{
                uri: 'https://uni.onekey-asset.com/static/chain/btc.png',
              }}
            />
            <Image
              size="$14"
              borderRadius="$3"
              $gtLg={{
                w: '$12',
                h: '$12',
              }}
              source={{
                uri: 'https://uni.onekey-asset.com/static/chain/btc.pn',
              }}
            />
          </YStack>
        ),
      },
      {
        title: 'onError',
        element: (
          <YStack gap="$4">
            <Image
              size="$10"
              source={{
                uri: 'https://uni.onekey-asset.com/static/chain/btc.pn',
              }}
              fallback={<Icon name="ImageMountainsOutline" size="$8" />}
            />
            <Image
              size="$10"
              source={null as any}
              fallback={<Icon name="ImageMountainsOutline" size="$8" />}
            />
          </YStack>
        ),
      },
      {
        title: 'images',
        element: (
          <YStack>
            {images1.map((image) => (
              <Image
                key={image}
                source={{ uri: image }}
                fallback={<Icon name="ImageMountainsOutline" size="$8" />}
              />
            ))}
            {images2.map((image) => (
              <Image
                key={image}
                source={{ uri: image }}
                fallback={<Icon name="ImageMountainsOutline" size="$8" />}
              />
            ))}
          </YStack>
        ),
      },
    ]}
  />
);

export default ImageGallery;
