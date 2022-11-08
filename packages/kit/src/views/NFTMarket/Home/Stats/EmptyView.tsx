import React, { ComponentProps, FC, useMemo } from 'react';

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
const EmptyView: FC<Props> = ({ isTab, numberOfData, ...rest }) => {
  const isVerticalLayout = useIsVerticalLayout();
  const listData = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < numberOfData; i += 1) {
      arr.push(i);
    }
    return arr;
  }, [numberOfData]);

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
          <ListItem.Column>
            <Box pb="24px" w="16px">
              <Skeleton shape="Body1" width={16} />
            </Box>
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
      {...rest}
    />
  );
};

export default EmptyView;
