import { Skeleton } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const SelectGallery = () => (
  <Layout
    description="..."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: '默认状态',
        element: <Skeleton />,
      },
    ]}
  />
);

export default SelectGallery;
