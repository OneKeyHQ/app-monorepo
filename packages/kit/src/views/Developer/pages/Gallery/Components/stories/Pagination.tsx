import { useState } from 'react';

import { Pagination, Stack, XStack, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const DefaultPagination = () => {
  const [current, setCurrent] = useState(1);
  return (
    <Pagination
      current={current}
      total={10}
      onChange={(page) => setCurrent(page)}
    />
  );
};

const NoControlsPagination = () => {
  const [current, setCurrent] = useState(1);
  return (
    <Pagination
      current={current}
      total={10}
      onChange={(page) => setCurrent(page)}
      showControls={false}
    />
  );
};

const DisabledControlsPagination = () => {
  const [current, setCurrent] = useState(5);
  return (
    <Pagination
      current={current}
      total={10}
      onChange={(page) => setCurrent(page)}
      disableControls
    />
  );
};

const LargePagination = () => {
  const [current, setCurrent] = useState(1);
  return (
    <Pagination
      current={current}
      total={100}
      onChange={(page) => setCurrent(page)}
    />
  );
};

const ButtonSizesPagination = () => {
  const [current, setCurrent] = useState(5);
  return (
    <YStack gap="$6">
      <XStack alignItems="center">
        <Pagination
          current={current}
          total={10}
          onChange={(page) => setCurrent(page)}
          pageButtonSize="small"
        />
      </XStack>
      <XStack alignItems="center">
        <Pagination
          current={current}
          total={10}
          onChange={(page) => setCurrent(page)}
          pageButtonSize="medium"
        />
      </XStack>
      <XStack alignItems="center">
        <Pagination
          current={current}
          total={10}
          onChange={(page) => setCurrent(page)}
          pageButtonSize="large"
        />
      </XStack>
    </YStack>
  );
};

const SiblingCountPagination = () => {
  const [current, setCurrent] = useState(10);
  return (
    <YStack gap="$6">
      <Stack>
        <Pagination
          current={current}
          total={20}
          onChange={(page) => setCurrent(page)}
          siblingCount={0}
        />
      </Stack>
      <Stack>
        <Pagination
          current={current}
          total={20}
          onChange={(page) => setCurrent(page)}
          siblingCount={1}
        />
      </Stack>
      <Stack>
        <Pagination
          current={current}
          total={20}
          onChange={(page) => setCurrent(page)}
          siblingCount={2}
        />
      </Stack>
    </YStack>
  );
};

const MaxPagesPagination = () => {
  const [current1, setCurrent1] = useState(1);
  const [current2, setCurrent2] = useState(1);
  return (
    <YStack gap="$6">
      <Stack>
        <Pagination
          current={current1}
          total={20}
          maxPages={10}
          onChange={(page) => setCurrent1(page)}
        />
      </Stack>
      <Stack>
        <Pagination
          current={current2}
          total={5}
          maxPages={10}
          onChange={(page) => setCurrent2(page)}
        />
      </Stack>
    </YStack>
  );
};

const PaginationGallery = () => (
  <Layout
    componentName="Pagination"
    description="The pagination component is used when there is a large amount of content that needs to be paginated, helping users to easily browse and switch between different pages of content."
    suggestions={[
      'Always provide clear page navigation functionality',
      'For a large number of pages, use ellipses (...) to simplify the interface',
      'The current page should be clearly distinguished from other pages',
    ]}
    filePath={__CURRENT_FILE_PATH__}
    elements={[
      {
        title: 'Default',
        element: <DefaultPagination />,
      },
      {
        title: 'Without Controls',
        element: <NoControlsPagination />,
      },
      {
        title: 'Disabled Controls',
        element: <DisabledControlsPagination />,
      },
      {
        title: 'Large Page Count',
        element: <LargePagination />,
      },
      {
        title: 'Different Button Sizes',
        element: <ButtonSizesPagination />,
      },
      {
        title: 'Different Sibling Count',
        element: <SiblingCountPagination />,
      },
      {
        title: 'Max Pages Limit',
        element: <MaxPagesPagination />,
      },
    ]}
  />
);

export default PaginationGallery;
