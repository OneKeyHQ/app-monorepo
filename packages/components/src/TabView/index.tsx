import {
  PageHeaderView,
  PageContentView,
  PageManager,
  SelectedLabel,
} from 'react-native-tab-page-view';

PageHeaderView.defaultProps = {
  ...PageHeaderView.defaultProps,
  titleFromItem: (item: any) => (item as { title: string }).title,
  itemContainerStyle: { paddingHorizontal: 10, marginLeft: 10 },
  itemTitleStyle: { fontSize: 15 },
  itemTitleNormalStyle: { color: '#333' },
  itemTitleSelectedStyle: { color: 'orange', fontSize: 17 },
  cursorStyle: {
    width: null,
    // width: 30,
    // borderRadius: 1,
    height: 2,
    backgroundColor: 'orange',
  },
};

export { PageHeaderView, PageContentView, PageManager, SelectedLabel };
