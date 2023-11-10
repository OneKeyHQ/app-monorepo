import { Alert, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ButtonsGallery = () => (
  <Layout
    description="..."
    suggestions={[]}
    boundaryConditions={[]}
    elements={[
      {
        title: 'State',
        element: (
          <YStack space="$4">
            <Alert
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
            />
            <Alert
              type="success"
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
            />
            <Alert
              type="critical"
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
            />
            <Alert
              type="info"
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
            />
            <Alert
              type="warning"
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
            />
          </YStack>
        ),
      },
      {
        title: 'Dismiss',
        element: (
          <YStack space="$4">
            <Alert
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
              closable
            />
          </YStack>
        ),
      },
      {
        title: 'Actions',
        element: (
          <YStack space="$4">
            <Alert
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
              action={{ primary: 'Action' }}
            />
            <Alert
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
              action={{
                primary: 'Action',
                onPrimaryPress() {
                  alert('primary');
                },
                secondary: 'Learn More',
                onSecondaryPress() {
                  alert('secondary');
                },
              }}
            />
          </YStack>
        ),
      },
    ]}
  />
);

export default ButtonsGallery;
