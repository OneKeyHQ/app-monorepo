import { useCallback, useContext, useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';

import { PageContext } from './PageContext';

import type { IPageLifeCycle } from './type';

export const usePage = () => {
  const { pageOffsetRef, pageRef } = useContext(PageContext);
  const getContentOffset = useCallback(
    () => pageOffsetRef?.current,
    [pageOffsetRef],
  );
  return {
    pageRef: pageRef?.current,
    getContentOffset,
  };
};

export function usePageLifeCycle(params?: IPageLifeCycle) {
  const navigation = useNavigation();
  const { onMounted, onUnmounted } = params || {};
  useEffect(() => {
    if (!onMounted || !onUnmounted) {
      return;
    }
    const unsubscribe = navigation.addListener('transitionEnd' as any, (e) => {
      const {
        data: { closing },
      } = e as {
        data: {
          closing: boolean;
        };
        target: string;
        type: string;
      };

      if (closing) {
        onUnmounted?.();
      } else {
        onMounted?.();
      }
    });

    return () => {
      setTimeout(() => {
        unsubscribe();
      }, 100);
    };
  }, [navigation, onMounted, onUnmounted]);
}

export const usePageMounted = (onMounted: IPageLifeCycle['onMounted']) => {
  usePageLifeCycle({ onMounted });
};

export const usePageUnMounted = (
  onUnmounted: IPageLifeCycle['onUnmounted'],
) => {
  usePageLifeCycle({ onUnmounted });
};
