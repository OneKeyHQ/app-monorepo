import { type FC, useCallback, useContext } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Stack,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import ScrollableButtonGroup from '@onekeyhq/components/src/ScrollableButtonGroup/ScrollableButtonGroup';

import FavContainer from '../../Explorer/FavContainer';
import { DiscoverContext, useBanners, useGroupDapps } from '../context';
import { DappBanner } from '../DappBanner';
import { DappItemOutline, DappItemPlain } from '../DappRenderItem';
import {
  DappItemPlainContainerLayout,
  PageLayout,
  PageWidthLayoutContext,
} from '../DappRenderLayout';
import { EmptySkeleton } from '../EmptySkeleton';
import { discoverUIEventBus } from '../eventBus';
import { SeeAllButton } from '../SeeAllButton';

import type { CategoryType, GroupDappsType } from '../../type';

const BannerContent = () => {
  const banners = useBanners();
  const isSmall = useIsVerticalLayout();
  if (!banners.length) {
    return null;
  }
  return (
    <Box w="full" py="4" pl="4" pr={!isSmall ? '4' : undefined}>
      <ScrollableButtonGroup
        justifyContent="center"
        bg="transparent"
        leftButtonProps={{
          size: 'base',
          type: 'basic',
          ml: '16px',
        }}
        rightButtonProps={{
          size: 'base',
          type: 'basic',
          mr: '16px',
        }}
      >
        {banners.map((item, index) => (
          <Box pr={isSmall || index !== banners.length - 1 ? '4' : undefined}>
            <DappBanner
              key={item._id}
              title={item.title}
              description={item.description}
              image={item.logoURL}
              url={item.url}
            />
          </Box>
        ))}
      </ScrollableButtonGroup>
    </Box>
  );
};

type ContentHeaderProps = { title: string; id?: string };
const ContentHeader: FC<ContentHeaderProps> = ({ title, id }) => (
  <Box w="full" justifyContent="space-between" flexDirection="row" py="2">
    <Typography.Heading>{title}</Typography.Heading>
    <SeeAllButton title={title} tagId={id} />
  </Box>
);

type ContentProps = {
  data: GroupDappsType;
};

const VerticalContent: FC<ContentProps> = ({ data }) => (
  <Box>
    <Box px="4">
      <ContentHeader title={data.label} id={data.id} />
    </Box>
    <Box px="4">
      <DappItemPlainContainerLayout space={4} offset={-32}>
        {data.items.map((item) => (
          <FavContainer
            key={item._id}
            url={item.url}
            hoverButtonProps={{
              right: '8px',
              top: '8px',
            }}
          >
            <DappItemPlain
              title={item.name}
              logoURI={item.logoURL}
              description={item.subtitle}
              networkIds={item.networkIds}
              url={item.url}
            />
          </FavContainer>
        ))}
      </DappItemPlainContainerLayout>
    </Box>
  </Box>
);

const HorizontalContent: FC<ContentProps> = ({ data }) => {
  if (!data.items || data.items.length === 0) {
    return null;
  }
  return (
    <Box>
      <Box px="4">
        <ContentHeader title={data.label} id={data.id} />
      </Box>
      <Box>
        <ScrollableButtonGroup
          justifyContent="center"
          bg="transparent"
          leftButtonProps={{
            size: 'base',
            type: 'basic',
            ml: '16px',
          }}
          rightButtonProps={{
            size: 'base',
            type: 'basic',
            mr: '16px',
          }}
          pl="4"
        >
          {data.items.map((item) => (
            <Box mr="3" key={item._id}>
              <FavContainer
                url={item.url}
                hoverButtonProps={{
                  right: '8px',
                  top: '8px',
                }}
              >
                <DappItemOutline
                  title={item.name}
                  logoURI={item.logoURL}
                  description={item.subtitle}
                  networkIds={item.networkIds}
                  url={item.url}
                />
              </FavContainer>
            </Box>
          ))}
        </ScrollableButtonGroup>
      </Box>
    </Box>
  );
};

const Tag = ({ item }: { item: CategoryType }) => {
  const onPress = useCallback(() => {
    discoverUIEventBus.emit('pressTag', item);
  }, [item]);

  return (
    <Pressable
      py="1"
      px="2.5"
      borderRadius="full"
      bg="surface-neutral-subdued"
      mr="2"
      mb="2"
      flexDirection="row"
      _hover={{ bg: 'surface-neutral-hovered' }}
      _pressed={{ bg: 'surface-neutral-pressed' }}
      onPress={onPress}
    >
      <Box mr={0.5}>
        <Icon name="HashtagMini" size={20} color="icon-success" />
      </Box>
      <Typography.Body2Strong>{item.name}</Typography.Body2Strong>
    </Pressable>
  );
};

const TagContent = () => {
  const { categories } = useContext(DiscoverContext);
  const intl = useIntl();
  return (
    <Box mt="4" px="4">
      <Box>
        <Typography.Heading>
          {intl.formatMessage({ id: 'form__all_tags' })}
        </Typography.Heading>
      </Box>
      <Box flexDirection="row" mt="4" w="full" flexWrap="wrap">
        {categories.map((o) => (
          <Tag key={o.id} item={o} />
        ))}
      </Box>
    </Box>
  );
};

const SectionFeaturedContent = () => {
  const groupDapps = useGroupDapps();
  const { fullwidth } = useContext(PageWidthLayoutContext);
  if (groupDapps.length === 0 || !fullwidth) {
    return (
      <Box py="2">
        <EmptySkeleton />
      </Box>
    );
  }
  return (
    <Box w="full" pb="2">
      <BannerContent />
      <Stack direction="column" space="2">
        {groupDapps.map((item, index) =>
          index % 2 === 0 ? (
            <VerticalContent key={item.label} data={item} />
          ) : (
            <HorizontalContent key={item.label} data={item} />
          ),
        )}
      </Stack>
      <TagContent />
    </Box>
  );
};

export const SectionFeatured = () => (
  <PageLayout>
    <SectionFeaturedContent />
  </PageLayout>
);
