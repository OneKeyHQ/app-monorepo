import { useMemo } from 'react';

import { Skeleton, Stack, XStack, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DefaultTitle } from './DefaultTitle';
import { SearchInput } from './SearchInput';
import { WelcomeItem } from './WelcomeItem';

// Define types for our component
type IPositionType = {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
};

type IItemType = {
  position: IPositionType;
  dappIndex: number;
  size: string;
};

// Component to render the dapp logos on either side
function DappSideDisplay({
  items,
  shuffledDapps,
  sideStackProps,
}: {
  items: IItemType[];
  shuffledDapps: Array<{ logo?: string; url?: string }>;
  sideStackProps: Record<string, any>;
}) {
  return (
    <Stack {...sideStackProps}>
      {items.map((item, index) => {
        const dapp = shuffledDapps[item.dappIndex];
        if (!dapp) return null;

        return (
          <WelcomeItem
            position="absolute"
            {...item.position}
            key={`item-${index}`}
            logo={dapp.logo}
            url={dapp.url}
            size={item.size}
          />
        );
      })}
    </Stack>
  );
}

export function Welcome({ banner }: { banner: React.ReactNode }) {
  const media = useMedia();

  // Fetch discovery data
  const { result: discoveryData, isLoading } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceDiscovery.fetchDiscoveryHomePageData(),
    [],
    {
      watchLoading: true,
    },
  );

  // Find the "Onekey hot" category and extract its dapps
  const dapps = useMemo(() => {
    const onekeyHotCategory = discoveryData?.categories?.find(
      (category) => category.name === 'Onekey hot',
    );
    return onekeyHotCategory?.dapps || [];
  }, [discoveryData]);

  // Create a randomized array of dapps
  const shuffledDapps = useMemo(
    () => [...dapps].sort(() => Math.random() - 0.5),
    [dapps],
  );

  // Configuration for left side items
  const leftSideItems = [
    { position: { top: '25%', right: '$28' }, dappIndex: 0, size: '$14' },
    { position: { bottom: '25%', right: '$12' }, dappIndex: 1, size: '$12' },
    { position: { top: '30%', right: '$0' }, dappIndex: 2, size: '$9' },
  ];

  // Configuration for right side items
  const rightSideItems = [
    { position: { top: '22%', left: '$28' }, dappIndex: 3, size: '$12' },
    { position: { bottom: '22%', left: '$11' }, dappIndex: 4, size: '$10' },
    { position: { top: '40%', left: '$2' }, dappIndex: 5, size: '$8' },
  ];

  // Shared stack props for the side containers
  const sideStackProps = {
    $sm: { display: 'none' as const },
    flex: 1,
    width: '$50',
    height: '100%',
  };

  // If loading, show a loading state
  if (isLoading) {
    return (
      <XStack width="100%" $gtSm={{ justifyContent: 'center' }}>
        <Stack
          alignItems="center"
          justifyContent="center"
          width="auto"
          position="relative"
          gap="$5"
          px="$5"
          py="$6"
          minHeight="$48"
          $sm={{
            width: '100%',
          }}
        >
          <Skeleton width="$40" height="$12" />
          <Skeleton width="$52" height="$10" />
        </Stack>
      </XStack>
    );
  }

  // Extract both platform and media conditions into the showDefaultTitle variable
  const showDefaultTitle =
    media.gtSm || platformEnv.isExtension || platformEnv.isWeb;

  return (
    <XStack width="100%" $gtSm={{ justifyContent: 'center' }}>
      {/* Left side with logo items */}
      <DappSideDisplay
        items={leftSideItems}
        shuffledDapps={shuffledDapps}
        sideStackProps={sideStackProps}
      />

      {/* Center content */}
      <Stack
        alignItems="center"
        justifyContent="center"
        width="auto"
        position="relative"
        gap="$5"
        px="$5"
        py="$6"
        $gtMd={{
          minHeight: '$60',
        }}
        $sm={{
          width: '100%',
        }}
      >
        {/* Show banner if provided, otherwise show DefaultTitle based on conditions */}
        {banner || (showDefaultTitle && <DefaultTitle />)}
        <SearchInput />
      </Stack>

      {/* Right side with logo items */}
      <DappSideDisplay
        items={rightSideItems}
        shuffledDapps={shuffledDapps}
        sideStackProps={sideStackProps}
      />
    </XStack>
  );
}
