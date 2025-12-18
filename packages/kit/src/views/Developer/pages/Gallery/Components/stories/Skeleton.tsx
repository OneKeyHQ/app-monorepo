import { Skeleton, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const SkeletonDemo = () => (
  <YStack gap="$4">
    <Skeleton radius="round" height={75} width={75} />
    <Skeleton width={250} h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
    <Skeleton width="100%" h="$8" />
  </YStack>
);

// const SkeletonGroupDemo = () => {
//   const [loading, setLoading] = useState(false);
//   return (
//     <YStack>
//       <Button
//         onPress={() => {
//           setLoading(true);
//           setTimeout(() => {
//             setLoading(false);
//           }, 3000);
//         }}
//       >
//         Click it to show LoadingView
//       </Button>
//       <YStack paddingVertical="$6">
//         <Skeleton.Group show={loading}>
//           <YStack gap="$4">
//             <Skeleton>
//               <Input />
//             </Skeleton>
//             <Skeleton>
//               <SizableText>Hello Onekey</SizableText>
//             </Skeleton>
//           </YStack>
//         </Skeleton.Group>
//       </YStack>
//     </YStack>
//   );
// };

const SelectGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="Skeleton"
    boundaryConditions={['不要建议同屏绘制超过20个视图']}
    elements={[
      {
        title: '默认状态',
        element: <SkeletonDemo />,
      },
      // {
      //   title: '默认状态',
      //   element: <SkeletonGroupDemo />,
      // },
    ]}
  />
);

export default SelectGallery;
