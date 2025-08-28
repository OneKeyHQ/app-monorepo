import { useState } from 'react';

import {
  Breadcrumb,
  Button,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IBreadcrumbItem } from '@onekeyhq/components/src/content/Breadcrumb';

import { Layout } from './utils/Layout';

const BreadcrumbGallery = () => {
  const [currentPath, setCurrentPath] = useState<string[]>(['Home']);

  const handleBreadcrumbClick = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
  };

  const addPath = (newPath: string) => {
    setCurrentPath([...currentPath, newPath]);
  };

  const resetPath = () => {
    setCurrentPath(['Home']);
  };

  const sampleItems: IBreadcrumbItem[] = [
    { label: 'Home', onClick: () => handleBreadcrumbClick(0) },
    { label: 'Products', onClick: () => handleBreadcrumbClick(1) },
    { label: 'Electronics', onClick: () => handleBreadcrumbClick(2) },
    { label: 'Smartphones', onClick: () => handleBreadcrumbClick(3) },
    { label: 'iPhone', onClick: () => handleBreadcrumbClick(4) },
  ];

  const longItems: IBreadcrumbItem[] = [
    { label: 'Home', onClick: () => console.log('Home clicked') },
    { label: 'Products', onClick: () => console.log('Products clicked') },
    { label: 'Electronics', onClick: () => console.log('Electronics clicked') },
    { label: 'Smartphones', onClick: () => console.log('Smartphones clicked') },
    { label: 'Apple', onClick: () => console.log('Apple clicked') },
    { label: 'iPhone', onClick: () => console.log('iPhone clicked') },
    { label: 'iPhone 15', onClick: () => console.log('iPhone 15 clicked') },
    {
      label: 'iPhone 15 Pro',
      onClick: () => console.log('iPhone 15 Pro clicked'),
    },
    { label: '256GB', onClick: () => console.log('256GB clicked') },
  ];

  const dynamicItems: IBreadcrumbItem[] = currentPath.map((path, index) => ({
    label: path,
    onClick: () => handleBreadcrumbClick(index),
  }));

  return (
    <Page>
      <Page.Header title="Breadcrumb" />
      <Page.Body>
        <Layout
          description="Breadcrumb component for navigation hierarchy"
          suggestions={[
            'Use breadcrumbs to show the current page location in a hierarchy',
            'Provide clear navigation back to parent pages',
            'Consider truncating long breadcrumb paths on mobile',
            'Use consistent separators and styling',
          ]}
          boundaryConditions={[
            'Empty items array',
            'Very long item labels',
            'Many items (overflow handling)',
            'Disabled/read-only state',
          ]}
        >
          <YStack space="$6" padding="$4">
            {/* Basic Breadcrumb */}

            <Breadcrumb items={sampleItems} />

            {/* Different Sizes */}


          </YStack>
        </Layout>
      </Page.Body>
    </Page>
  );
};

export default BreadcrumbGallery;
