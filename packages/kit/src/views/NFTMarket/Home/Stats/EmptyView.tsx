import type { ComponentProps, FC } from 'react';
import { useMemo } from 'react';

import {
  Box,
  CustomSkeleton,
  List,
  ListItem,
  Skeleton,
  useIsVerticalLayout,
} from '@onekeyhq/components';

type Props = {
  isTab?: boolean;
  numberOfData: number;
} & Pick<ComponentProps<typeof List>, 'ListHeaderComponent'>;
const renderSeparator = () => <Box h="4px" />;
const EmptyView: FC<Props> = ({ isTab, numberOfData, ...rest }) => {
  const isVerticalLayout = useIsVerticalLayout();
  const listData = new Array(numberOfData).fill(0);
  const SeparatorConfig = useMemo(() => {
    if (isVerticalLayout)
      return {
        ItemSeparatorComponent: renderSeparator,
      };
    return {
      showDivider: true,
    };
  }, [isVerticalLayout]);

  return (
    <List
      data={listData}
      renderItem={() => (
        <ListItem>
          <ListItem.Column>
            <CustomSkeleton
              width={isVerticalLayout ? '56px' : '40px'}
              height={isVerticalLayout ? '56px' : '40px'}
              borderRadius="12px"
            />
          </ListItem.Column>
          <ListItem.Column
            flex={1}
            text={{
              label: <Skeleton shape="Body1" />,
              description: <Skeleton shape="Body2" />,
            }}
          />
          <ListItem.Column>
            <Box pb={{ base: '24px', md: 0 }}>
              <Skeleton shape="Body1" />
            </Box>
          </ListItem.Column>
        </ListItem>
      )}
      keyExtractor={(item, index) => `${index}`}
      {...SeparatorConfig}
      {...rest}
    />
  );
};

export default EmptyView;
