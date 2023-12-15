import { useContext, useMemo } from 'react';

import { View } from '../../optimization';
import { ScrollView } from '../ScrollView';

import { BasicPage } from './BasicPage';
import { BasicPageFooter } from './BasicPageFooter';
import { PageContext } from './PageContext';

import type { IPageProps } from './type';

export function PageContainer({ children, skipLoading }: IPageProps) {
  const { options = {} } = useContext(PageContext);
  const { scrollEnabled } = options;

  return useMemo(
    () => (
      <BasicPage skipLoading={skipLoading}>
        {scrollEnabled ? (
          <View style={{ flex: 1 }}>
            <ScrollView flex={1} height="100%">
              {children}
            </ScrollView>
          </View>
        ) : (
          children
        )}

        <BasicPageFooter />
      </BasicPage>
    ),
    [skipLoading, scrollEnabled, children],
  );
}
