import type { FC } from 'react';

import { Box, Typography } from '@onekeyhq/components';
import ScrollableButtonGroup from '@onekeyhq/components/src/ScrollableButtonGroup/ScrollableButtonGroup';

import FavContainer from '../../Explorer/FavContainer';
import { useBanners, useGroupDapps } from '../context';
import { DappBanner } from '../DappBanner';
import { DappItemOutline, DappItemPlain } from '../DappRenderItem';
import { DappItemPlainContainerLayout } from '../DappRenderLayout';
import { EmptySkeleton } from '../EmptySkeleton';
import { SeeAllButton } from '../SeeAllButton';

import type { GroupDappsType } from '../../type';

const BannerContent = () => {
  const banners = useBanners();
  if (!banners.length) {
    return null;
  }
  return (
    <Box w="full" py="4">
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
        {banners.map((item) => (
          <Box mr="4">
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
    <Box pl="4">
      <ContentHeader title={data.label} id={data.id} />
    </Box>
    <Box px="4">
      <DappItemPlainContainerLayout space={4}>
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
      <Box pl="4">
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
            <Box mr="4" key={item._id}>
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

export const SectionFeatured = () => {
  const groupDapps = useGroupDapps();
  if (groupDapps.length === 0) {
    return (
      <Box py="2">
        <EmptySkeleton />
      </Box>
    );
  }
  return (
    <Box w="full" pb="2">
      <BannerContent />
      <Box>
        {groupDapps.map((item, index) =>
          index % 2 === 0 ? (
            <VerticalContent key={item.label} data={item} />
          ) : (
            <HorizontalContent key={item.label} data={item} />
          ),
        )}
      </Box>
    </Box>
  );
};
