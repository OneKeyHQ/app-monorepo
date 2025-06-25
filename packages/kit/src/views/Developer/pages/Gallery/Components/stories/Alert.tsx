import { Alert, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const AlertGallery = () => (
  <Layout
    componentName="Alert"
    filePath={__CURRENT_FILE_PATH__}
    description="Alert 组件用于向用户显示重要信息、警告或错误消息。它支持不同的状态类型、可关闭选项和操作按钮。"
    suggestions={[
      '使用适当的类型（success、critical、info、warning）来表达正确的信息级别',
      '确保 Alert 的标题简明扼要',
      '描述文本应该清晰地解释具体情况',
    ]}
    boundaryConditions={[
      '当使用 closable 属性时，确保用户有足够时间阅读信息',
      '避免在同一页面上显示过多的 Alert',
      '谨慎使用 fullBleed 模式，它最适合用于重要的全局通知',
    ]}
    elements={[
      {
        title: 'State',
        element: (
          <YStack gap="$4">
            <Alert
              title="type=default"
              description="Description here..."
              icon="PlaceholderOutline"
            />
            <Alert
              type="success"
              title="type=success"
              description="Description here..."
              icon="PlaceholderOutline"
            />
            <Alert
              type="critical"
              title="type=critical"
              description="Description here..."
              icon="PlaceholderOutline"
            />
            <Alert
              type="danger"
              title="type=danger"
              description="Description here..."
              icon="PlaceholderOutline"
            />
            <Alert
              type="info"
              title="type=info"
              description="Description here..."
              icon="PlaceholderOutline"
            />
            <Alert
              type="warning"
              title="type=warning"
              description="Description here..."
              icon="PlaceholderOutline"
            />
            <Alert
              title="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque nec elementum eros.  Vestibulum faucibus nibh id tincidunt sollicitudin. Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. Vestibulum faucibus nibh id tincidunt sollicitudin. "
              titleNumberOfLines={2}
              icon="PlaceholderOutline"
            />
            <Alert
              title="Lorem ipsum dolor sit amet"
              titleNumberOfLines={2}
              icon="PlaceholderOutline"
            />
          </YStack>
        ),
      },
      {
        title: 'Dismiss',
        element: (
          <YStack gap="$4">
            <Alert
              title="closable"
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
          <YStack gap="$4">
            <Alert
              title="primaryAction"
              description="Description here..."
              icon="PlaceholderOutline"
              action={{ primary: 'Action' }}
            />
            <Alert
              title="primaryAction, secondaryAction"
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
      {
        title: 'fullBleed',
        element: (
          <YStack gap="$4">
            <Alert
              fullBleed
              title="fullBleed"
              description="Description here..."
              icon="PlaceholderOutline"
              action={{ primary: 'Action' }}
            />
          </YStack>
        ),
      },
    ]}
  />
);

export default AlertGallery;
