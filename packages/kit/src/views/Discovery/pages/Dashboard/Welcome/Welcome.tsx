import { memo, useMemo } from 'react';

import { Stack, XStack, useMedia } from '@onekeyhq/components';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
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
  maxOpacity?: number;
  borderRadius?: number;
  initialRotation?: number;
};

// Configuration for left side items
const LEFT_SIDE_ITEMS: IItemType[] = [
  {
    position: { top: '30%', right: '$28' },
    dappIndex: 0,
    size: '$12',
    maxOpacity: 1,
    borderRadius: 18,
    initialRotation: -15,
  },
  {
    position: { bottom: '30%', right: '$12' },
    dappIndex: 1,
    size: '$10',
    maxOpacity: 0.8,
    borderRadius: 14,
    initialRotation: -10,
  },
  {
    position: { top: '30%', right: '$0' },
    dappIndex: 2,
    size: '$8',
    maxOpacity: 0.6,
    borderRadius: 10,
    initialRotation: 10,
  },
];

// Configuration for right side items
const RIGHT_SIDE_ITEMS: IItemType[] = [
  {
    position: { top: '30%', left: '$28' },
    dappIndex: 3,
    size: '$12',
    maxOpacity: 1,
    borderRadius: 18,
    initialRotation: 15,
  },
  {
    position: { bottom: '30%', left: '$12' },
    dappIndex: 4,
    size: '$10',
    maxOpacity: 0.8,
    borderRadius: 14,
    initialRotation: 10,
  },
  {
    position: { top: '35%', left: '$2' },
    dappIndex: 5,
    size: '$8',
    maxOpacity: 0.6,
    borderRadius: 10,
    initialRotation: -10,
  },
];

// Component to render the dapp logos on either side
function BaseDappSideDisplay({
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
            maxOpacity={item.maxOpacity}
            borderRadius={item.borderRadius}
            initialRotation={item.initialRotation}
          />
        );
      })}
    </Stack>
  );
}

const DappSideDisplay = memo(BaseDappSideDisplay);

export function Welcome({
  banner,
  discoveryData,
}: {
  banner: React.ReactNode;
  discoveryData?: { hot?: Array<{ logo?: string; url?: string }> };
}) {
  const media = useMedia();

  // Use the 'hot' data instead of finding the "Onekey hot" category
  const dapps = useMemo(() => discoveryData?.hot || [], [discoveryData]);

  // Create a randomized array of dapps
  const shuffledDapps = useMemo(
    () => [...dapps].sort(() => Math.random() - 0.5),
    [dapps],
  );

  // Shared stack props for the side containers
  const sideStackProps = useMemo(
    () => ({
      $sm: { display: 'none' as const },
      flex: 1,
      width: '$50',
      height: '100%',
    }),
    [],
  );

  // Extract both platform and media conditions into the showDefaultTitle variable
  const showDefaultTitle = useMemo(
    () => media.gtSm || platformEnv.isExtension || platformEnv.isWeb,
    [media.gtSm],
  );

  // Hide center content when no banner and md size
  const showCenterContent = useMemo(
    () => !!banner || showDefaultTitle,
    [banner, showDefaultTitle],
  );

  return (
    <XStack width="100%" $gtSm={{ justifyContent: 'center' }}>
      {/* Left side with logo items */}
      {!platformEnv.isNative ? (
        <ReviewControl>
          <DappSideDisplay
            items={LEFT_SIDE_ITEMS}
            shuffledDapps={shuffledDapps}
            sideStackProps={sideStackProps}
          />
        </ReviewControl>
      ) : null}

      {/* Center content - hidden when no banner and md size */}
      {showCenterContent ? (
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
          {banner || (showDefaultTitle && <DefaultTitle />)}
          {!platformEnv.isNative ? <SearchInput /> : null}
        </Stack>
      ) : null}

      {/* Right side with logo items */}
      {!platformEnv.isNative ? (
        <ReviewControl>
          <DappSideDisplay
            items={RIGHT_SIDE_ITEMS}
            shuffledDapps={shuffledDapps}
            sideStackProps={sideStackProps}
          />
        </ReviewControl>
      ) : null}
    </XStack>
  );
}
