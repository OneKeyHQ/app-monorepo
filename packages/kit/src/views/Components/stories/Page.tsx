import { Page } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const InputGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Page Header',
        element: <Page.Header title="Look At Title" />,
      },
      {
        title: 'Page Footer',
        element: <Page.Footer />,
      },
    ]}
  />
);

export default InputGallery;
