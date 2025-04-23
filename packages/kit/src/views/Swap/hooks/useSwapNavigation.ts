import { rootNavigationRef } from '@onekeyhq/components';
import { EModalSwapRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

export const handleSwapNavigation = (
  callback: (params: {
    isInSwapTab: boolean;
    isHasSwapModal: boolean;
    isSwapModalOnTheTop: boolean;
    hasModal: boolean;
  }) => void,
) => {
  const state = rootNavigationRef.current?.getRootState();
  if (state) {
    const tabIndex = state?.routes?.[0]?.state?.index || 0;
    const tabRoute = state?.routes?.[0]?.state?.routes?.[tabIndex];
    const isInSwapTab = tabRoute?.name === ETabRoutes.Swap;
    const hasModal = (state?.routes?.length || 0) > 1;
    let isHasSwapModal = false;
    let isSwapModalOnTheTop = false;

    let i = 1;
    const routes = state?.routes || [];
    while (i < routes.length) {
      const route = routes[i];
      const subRoutes = route?.state?.routes || [];
      for (let j = 0; j < subRoutes.length; j += 1) {
        const subRoute = subRoutes[j];
        const childRoutes = subRoute?.state?.routes || [];
        for (let k = 0; k < childRoutes.length; k += 1) {
          const childRoute = childRoutes[k];
          if (childRoute?.name === EModalSwapRoutes.SwapMainLand) {
            isHasSwapModal = true;
            isSwapModalOnTheTop =
              i === routes.length - 1 &&
              j === subRoutes.length - 1 &&
              k === childRoutes.length - 1;
            break;
          }
        }
      }

      if (isHasSwapModal) {
        break;
      }
      i += 1;
    }

    if (callback) {
      callback({
        isInSwapTab,
        isHasSwapModal,
        isSwapModalOnTheTop,
        hasModal,
      });
    }
  }
};

// example

const onConfirm = () => {
  handleSwapNavigation(
    ({ isInSwapTab, isHasSwapModal, isSwapModalOnTheTop, hasModal }) => {
      console.log(
        'swap__params',
        isInSwapTab,
        isHasSwapModal,
        isSwapModalOnTheTop,
        hasModal,
      );
      if (isInSwapTab) {
        if (hasModal) {
          // 2.swap tab have modal   关闭当前的所有 modal  通知 swap 进行询价
          rootNavigationRef.current?.goBack();
          setTimeout(() => {
            onConfirm();
          }, 50);
        } else {
          // 1.swap tab no modal
          // 不用做任何动作，直接给 swap 发 event 进行询价
        }
      } else if (isHasSwapModal) {
        if (isSwapModalOnTheTop) {
          // 4.no swap tab have swap modal no other modal    最外层是 swap modal 不需要做任何动作通知 swap modal 进行询价
        } else {
          // 5.no swap tab have swap modal have other modal   退回到 swap modal  再通知 swap modal 进行询价
          rootNavigationRef.current?.goBack();
          setTimeout(() => {
            onConfirm();
          }, 50);
        }
      } else {
        // 3.no swap tab no swap modal 打开 swap modal 通知 swap 进行询价
      }
    },
  );
};
