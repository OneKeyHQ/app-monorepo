import type { FC } from 'react';
import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Skeleton,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';

const ListItemSkeleton: FC<{ borderBottomRadius?: number }> = ({
  borderBottomRadius = 0,
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <Box
      p={4}
      bg="surface-default"
      shadow={undefined}
      borderWidth={1}
      borderColor="border-subdued"
      borderTopWidth={1}
      borderBottomWidth={1}
      borderBottomRadius={borderBottomRadius}
      w="100%"
      flexDirection="row"
      alignItems="center"
    >
      <Skeleton shape="Avatar" />
      <Box ml="12px" flexDirection="column" flex={1}>
        <Box flexDirection="row" alignItems="center">
          <Skeleton shape="Body1" />
        </Box>
        <Skeleton shape="Body2" />
      </Box>
      {!isVerticalLayout && (
        <Box flexDirection="column" flex={1} alignItems="flex-end">
          <Skeleton shape="Body2" />
        </Box>
      )}
      <Box flexDirection="column" flex={1} alignItems="flex-end">
        <>
          <Skeleton shape="Body1" />
          <Skeleton shape="Body2" />
        </>
      </Box>
    </Box>
  );
};

const ListHeaderSkeleton = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const iconOuterWidth = isVerticalLayout ? '24px' : '32px';
  const iconInnerWidth = isVerticalLayout ? 12 : 16;
  const iconBorderRadius = isVerticalLayout ? '12px' : '16px';

  return (
    <Box
      p={4}
      shadow={undefined}
      borderWidth={1}
      borderBottomWidth={0}
      borderColor="border-subdued"
      borderTopRadius={12}
      flexDirection="column"
    >
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box
          w={iconOuterWidth}
          h={iconOuterWidth}
          borderRadius={iconBorderRadius}
          bg="decorative-icon-one"
          justifyContent="center"
          alignItems="center"
          mr={isVerticalLayout ? '8px' : '12px'}
        >
          <Icon
            size={iconInnerWidth}
            color="icon-on-primary"
            name="DatabaseOutline"
          />
        </Box>
        {isVerticalLayout ? (
          <Skeleton shape="Body1" />
        ) : (
          <Skeleton shape="DisplayLarge" />
        )}
        <Box ml="auto" flexDirection="row" alignItems="center">
          <Skeleton shape="Body1" />
        </Box>
      </Box>
      <Box mt={isVerticalLayout ? '8px' : '16px'}>
        {isVerticalLayout ? (
          <Skeleton shape="DisplayLarge" />
        ) : (
          <Box flexDirection="row" w="full">
            <Typography.Subheading color="text-subdued" flex={1}>
              {intl.formatMessage({ id: 'title__assets' })}
            </Typography.Subheading>
            <Typography.Subheading
              ml="44px"
              color="text-subdued"
              flex={1}
              textAlign="right"
            >
              {intl.formatMessage({ id: 'content__price_uppercase' })}
            </Typography.Subheading>
            <Typography.Subheading
              color="text-subdued"
              flex={1}
              textAlign="right"
            >
              {intl.formatMessage({ id: 'form__value' })}
            </Typography.Subheading>
          </Box>
        )}
      </Box>
    </Box>
  );
};

const AssetsListSkeleton = () => (
  <Box
    style={{
      maxWidth: MAX_PAGE_CONTAINER_WIDTH,
      width: '100%',
      marginHorizontal: 'auto',
    }}
  >
    <ListHeaderSkeleton />
    <ListItemSkeleton />
    <ListItemSkeleton />
    <ListItemSkeleton borderBottomRadius={12} />
  </Box>
);
AssetsListSkeleton.displayName = 'AssetsListSkeleton';

export default memo(AssetsListSkeleton);
