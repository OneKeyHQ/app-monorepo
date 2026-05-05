import { IconButton, Tooltip, XStack, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const TooltipGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="Tooltip"
    description="A tooltip on web, with only accessibility output on native"
    elements={[
      {
        title: 'Default',
        element: (
          <XStack gap="$4">
            <Tooltip
              renderTrigger={<IconButton icon="EditOutline" />}
              renderContent="Qui nulla occaecat anim"
            />
          </XStack>
        ),
      },
      {
        title: 'Placements',
        element: (
          <XStack gap="$4">
            <Tooltip
              renderTrigger={<IconButton icon="ChevronTopOutline" />}
              renderContent="Qui nulla occaecat anim"
              placement="top"
            />
            <Tooltip
              renderTrigger={<IconButton icon="ChevronRightOutline" />}
              renderContent="Qui nulla occaecat anim"
              placement="right"
            />
            <Tooltip
              renderTrigger={<IconButton icon="ChevronBottomOutline" />}
              renderContent="Qui nulla occaecat anim"
            />
            <Tooltip
              renderTrigger={<IconButton icon="ChevronLeftOutline" />}
              renderContent="Qui nulla occaecat anim"
              placement="left"
            />
          </XStack>
        ),
      },
      {
        title: 'Max width',
        element: (
          <XStack gap="$4">
            <Tooltip
              renderTrigger={<IconButton icon="EditOutline" />}
              renderContent="Excepteur cillum laboris ea sint esse reprehenderit. Culpa fugiat aliqua elit sit deserunt cupidatat adipisicing velit non ad. Magna qui aute eiusmod deserunt elit commodo culpa nostrud aute veniam esse elit eu."
            />
          </XStack>
        ),
      },
      {
        title: 'Hovering',
        element: (
          <XStack gap="$4">
            <Tooltip
              hovering
              placement="bottom-end"
              renderTrigger={<IconButton icon="InfoCircleOutline" />}
              renderContent={
                <YStack gap="$2" p="$2">
                  <XStack>Hover over trigger to show tooltip</XStack>
                  <XStack>Tooltip stays open when hovering over content</XStack>
                </YStack>
              }
            />
          </XStack>
        ),
      },
    ]}
  />
);

export default TooltipGallery;
