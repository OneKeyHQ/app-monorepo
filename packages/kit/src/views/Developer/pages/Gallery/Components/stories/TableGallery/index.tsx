import { Layout } from '../utils/Layout';

import { BasicTableDemo } from './components/BasicTableDemo';
import { CustomRenderingDemo } from './components/CustomRenderingDemo';
import { InteractiveTableDemo } from './components/InteractiveTableDemo';

const TableGallery = () => (
  <Layout
    componentName="Table"
    description="表格组件用于展示结构化数据，支持自定义渲染、排序、拖拽等功能"
    suggestions={[
      '使用 columns 属性定义表格列结构',
      '通过 render 函数自定义单元格内容',
      '使用 onRow 和 onHeaderRow 处理交互事件',
      '启用 stickyHeader 保持表头可见',
      '使用 showSkeleton 显示加载状态',
    ]}
    boundaryConditions={[
      '确保 keyExtractor 返回唯一值',
      '自定义渲染函数需要处理空值情况',
      '大数据量时建议使用 estimatedItemSize 优化性能',
      '拖拽功能在移动端需要长按触发',
    ]}
    elements={[
      {
        title: '基础表格',
        description: '展示基本的表格结构和数据',
        element: <BasicTableDemo />,
      },
      {
        title: '自定义渲染',
        description: '使用 render 函数自定义单元格内容和样式',
        element: <CustomRenderingDemo />,
      },
      {
        title: '交互功能',
        description:
          '支持行点击、长按和表头排序。演示四种排序模式：正常排序、只能升序、只能降序、完全无排序',
        element: <InteractiveTableDemo />,
      },
    ]}
    getFilePath={() => __CURRENT_FILE_PATH__}
  />
);

export default TableGallery;
