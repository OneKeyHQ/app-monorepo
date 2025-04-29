import { Empty } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const EmptyGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="Empty"
    elements={[
      {
        title: 'Default',
        element: (
          <Empty
            icon="SearchOutline"
            title="No Results"
            description="Ad cillum pariatur culpa incididunt esse sint fugiat esse veniam"
            buttonProps={{
              children: 'Button',
              onPress: () => {
                alert('Button pressed');
              },
            }}
          />
        ),
      },
    ]}
  />
);

export default EmptyGallery;
