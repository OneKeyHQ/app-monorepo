import { UnOrderedList } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const UnOrderedListGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="UnOrderedList"
    elements={[
      {
        title: 'Basic UnOrderedList',
        element: (
          <UnOrderedList>
            <UnOrderedList.Item>
              First item with default bullet
            </UnOrderedList.Item>
            <UnOrderedList.Item>
              Second item with default bullet
            </UnOrderedList.Item>
            <UnOrderedList.Item>
              Third item with default bullet
            </UnOrderedList.Item>
          </UnOrderedList>
        ),
      },
      {
        title: 'UnOrderedList with Icons',
        element: (
          <UnOrderedList>
            <UnOrderedList.Item icon="CheckRadioSolid">
              Item with check icon - completed task
            </UnOrderedList.Item>
            <UnOrderedList.Item icon="XCircleSolid">
              Item with X icon - failed task
            </UnOrderedList.Item>
            <UnOrderedList.Item icon="InboxSolid">
              Item with warning icon - needs attention
            </UnOrderedList.Item>
            <UnOrderedList.Item icon="InfoCircleSolid">
              Item with info icon - additional information
            </UnOrderedList.Item>
          </UnOrderedList>
        ),
      },
      {
        title: 'UnOrderedList with Custom Icon Props',
        element: (
          <UnOrderedList>
            <UnOrderedList.Item
              icon="HeartSolid"
              iconProps={{ color: '$iconCritical', size: '$6' }}
            >
              Item with red heart icon
            </UnOrderedList.Item>
            <UnOrderedList.Item
              icon="StarSolid"
              iconProps={{ color: '$iconCaution', size: '$5' }}
            >
              Item with yellow star icon
            </UnOrderedList.Item>
            <UnOrderedList.Item
              icon="KingVipCrownSolid"
              iconProps={{ color: '$iconSuccess', size: '$4' }}
            >
              Item with green check icon
            </UnOrderedList.Item>
          </UnOrderedList>
        ),
      },
      {
        title: 'Mixed List (Icons and Bullets)',
        element: (
          <UnOrderedList>
            <UnOrderedList.Item icon="MessageLikeSolid">
              Document item with icon
            </UnOrderedList.Item>
            <UnOrderedList.Item>
              Regular item with default bullet point
            </UnOrderedList.Item>
            <UnOrderedList.Item icon="FolderSolid">
              Folder item with icon
            </UnOrderedList.Item>
            <UnOrderedList.Item>
              Another regular item with default bullet
            </UnOrderedList.Item>
          </UnOrderedList>
        ),
      },
      {
        title: 'Feature List Example',
        element: (
          <UnOrderedList>
            <UnOrderedList.Item
              icon="CheckRadioSolid"
              iconProps={{ color: '$iconSuccess' }}
            >
              Support for Manta, Neurai, and Nervos networks
            </UnOrderedList.Item>
            <UnOrderedList.Item
              icon="CheckRadioSolid"
              iconProps={{ color: '$iconSuccess' }}
            >
              Support for LNURL Auth authorization signing
            </UnOrderedList.Item>
            <UnOrderedList.Item
              icon="CheckRadioSolid"
              iconProps={{ color: '$iconSuccess' }}
            >
              Ability to view firmware version in device information
            </UnOrderedList.Item>
            <UnOrderedList.Item
              icon="CheckRadioSolid"
              iconProps={{ color: '$iconSuccess' }}
            >
              New precision display under the Celestia network
            </UnOrderedList.Item>
          </UnOrderedList>
        ),
      },
    ]}
  />
);

export default UnOrderedListGallery;
