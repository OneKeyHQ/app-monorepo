import { useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';

export interface IPageLifeCycle {
  onMounted?: () => void;
  onUnmounted?: () => void;
}

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

export function PageLifeCycle({ onMounted, onUnmounted }: IPageLifeCycle) {
  usePageLifeCycle();
  return null;
}
