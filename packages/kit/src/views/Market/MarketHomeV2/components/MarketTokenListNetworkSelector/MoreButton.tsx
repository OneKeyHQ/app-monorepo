import type { FC } from 'react';

import { Button } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';

type IMoreButtonProps = Omit<IButtonProps, 'children'>;

const MoreButton: FC<IMoreButtonProps> = ({ ...rest }) => (
  <Button
    variant="tertiary"
    size="medium"
    iconAfter="ChevronDownSmallOutline"
    iconColor="$iconSubdued"
    $platform-native={{
      px: '$2',
      py: '$1',
    }}
    color="$textSubdued"
    {...rest}
  >
    More
  </Button>
);

export { MoreButton };
