import { useMedia } from '@onekeyhq/components';

import { CurrentLevelCardDesktop } from './components/CurrentLevelCardDesktop';
import { CurrentLevelCardMobile } from './components/CurrentLevelCardMobile';

import type { ICurrentLevelCardProps } from './types';

export function CurrentLevelCard(props: ICurrentLevelCardProps) {
  const { gtMd } = useMedia();

  if (gtMd) {
    return <CurrentLevelCardDesktop {...props} />;
  }

  return <CurrentLevelCardMobile {...props} />;
}
