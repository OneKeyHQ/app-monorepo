/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, { FC, useMemo, useRef } from 'react';

import { Portal } from '@gorhom/portal';
import { Box } from 'native-base';
import ReactDOM from 'react-dom';
import { useIntl } from 'react-intl';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import OkButton from '../Button';
import { TBottomBarRefAttr } from '../Layout/BottomTabs/types';

import BottomSheetComponent from './BottomSheet';
import Modalize from './Modalize';
import { SelectBottomBarProps } from './types';

const SelectBottonBar: FC<SelectBottomBarProps> = ({ children }) => {
  //   const ITEM_COUNT = 3;
  //   const innerHeight = 72 * ITEM_COUNT + 32 + 56;
  const bottomBarRef = useRef<TBottomBarRefAttr>();
  const intl = useIntl();
  // useImperativeHandle(ref, () => ({
  //   open: () => {
  //     // @ts-expect-error
  //     bottomBarRef.current?.open?.();
  //     bottomBarRef.current?.expand?.();
  //   },
  // }));
  const showSelectModal = () => {
    if (platformEnv?.isWeb) {
      // @ts-expect-error
      bottomBarRef.current?.open?.();
    } else {
      bottomBarRef.current?.expand?.();
    }
  };
  const renderComponent = useMemo(() => {
    if (platformEnv?.isWeb) {
      return ReactDOM.createPortal(
        <Modalize
          onClose={() => {}}
          onOpen={() => {}}
          handleClose={() => {}}
          handleOpen={() => {}}
          ref={(el) => (bottomBarRef.current = el || undefined)}
        >
          {children}
          {[1, 2, 3, 4, 5, 6].map((i, index) => (
            <Box key={index}>
              {intl.formatMessage({
                id: 'action__cancel',
              })}
              {index}
            </Box>
          ))}
        </Modalize>,
        document.body,
      );
    }
    return (
      <Portal>
        <BottomSheetComponent
          onClose={() => {}}
          onOpen={() => {}}
          handleClose={() => {}}
          handleOpen={() => {}}
          ref={(el) => (bottomBarRef.current = el || undefined)}
        >
          {[1, 2, 3, 4, 5, 6].map((i, index) => (
            <Box key={index}>
              {intl.formatMessage({
                id: 'action__cancel',
              })}
              {index}
            </Box>
          ))}
        </BottomSheetComponent>
      </Portal>
    );
  }, [children, intl]);
  return (
    <>
      {renderComponent}
      <OkButton ml="3" size="lg" minW="50px" onPress={showSelectModal}>
        {intl.formatMessage({
          id: 'action__cancel',
        })}
      </OkButton>
    </>
  );
};
SelectBottonBar.displayName = 'SelectBottonBar';
export default SelectBottonBar;
