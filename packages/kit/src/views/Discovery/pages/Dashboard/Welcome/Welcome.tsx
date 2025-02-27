import { Stack, XStack } from '@onekeyhq/components';
import { browserWelcomeLogos } from '@onekeyhq/shared/src/utils/browserUtils';
import type { ImageURISource } from 'react-native';

import { DefaultTitle } from './DefaultTitle';
import { SearchInput } from './SearchInput';
import { WelcomeItem } from './WelcomeItem';

export function Welcome({ banner }: { banner: React.ReactNode }) {
  const logos = Object.values(browserWelcomeLogos);

  // Configuration for left side items
  const leftSideItems = [
    { position: { top: '25%', right: '$28' }, logoIndex: 0, size: '$14' },
    { position: { bottom: '25%', right: '$12' }, logoIndex: 1, size: '$12' },
    { position: { top: '30%', right: '$0' }, logoIndex: 2, size: '$9' },
  ];

  // Configuration for right side items
  const rightSideItems = [
    { position: { top: '22%', left: '$28' }, logoIndex: 3, size: '$12' },
    { position: { bottom: '22%', left: '$11' }, logoIndex: 4, size: '$10' },
    { position: { top: '40%', left: '$2' }, logoIndex: 5, size: '$8' },
  ];

  // Shared stack props for the side containers
  const sideStackProps = {
    $sm: { display: 'none' as const },
    flex: 1,
    width: '$50',
    height: '100%',
  };

  return (
    <XStack width="100%" $gtSm={{ justifyContent: 'center' }}>
      {/* Left side with logo items */}
      <Stack {...sideStackProps}>
        {leftSideItems.map((item, index) => (
          <WelcomeItem
            position="absolute"
            {...item.position}
            key={logos[item.logoIndex]?.name || `left-item-${index}`}
            logo={logos[item.logoIndex]?.icon}
            url={logos[item.logoIndex]?.url}
            size={item.size}
          />
        ))}
      </Stack>

      {/* Center content */}
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
        {banner || <DefaultTitle />}
        <SearchInput />
      </Stack>

      {/* Right side with logo items */}
      <Stack {...sideStackProps}>
        {rightSideItems.map((item, index) => (
          <WelcomeItem
            position="absolute"
            {...item.position}
            key={logos[item.logoIndex]?.name || `right-item-${index}`}
            logo={logos[item.logoIndex]?.icon}
            url={logos[item.logoIndex]?.url}
            size={item.size}
          />
        ))}
      </Stack>
    </XStack>
  );
}
