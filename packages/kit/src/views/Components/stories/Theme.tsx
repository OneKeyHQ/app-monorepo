import { useDispatch } from 'react-redux';

import { NewButton, XStack } from '@onekeyhq/components';

import { setTheme } from '../../../store/reducers/settings';

import { Layout } from './utils/Layout';

const ThemeGallery = () => {
  const dispatch = useDispatch();
  return (
    <Layout
      description="图标是一种视觉符号，用于表示对象或概念"
      suggestions={['图标的设计应该简洁、易于理解、易于识别']}
      boundaryConditions={[]}
      elements={[
        {
          title: 'Toggle Theme',
          element: (
            <XStack space={10}>
              <NewButton
                onPress={() => {
                  dispatch(setTheme('light'));
                }}
              >
                Light Theme
              </NewButton>
              <NewButton
                variant="primary"
                onPress={() => {
                  dispatch(setTheme('dark'));
                }}
              >
                Night Theme
              </NewButton>
            </XStack>
          ),
        },
      ]}
    />
  );
};

export default ThemeGallery;
