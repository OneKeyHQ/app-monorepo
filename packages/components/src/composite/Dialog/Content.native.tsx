import { useCallback, useEffect, useRef, useState } from 'react';

import { AnimatePresence } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Spinner, Stack, YStack } from '../../primitives';

import type { IDialogContentProps } from './type';
import type { LayoutChangeEvent, View } from 'react-native';
import type { TamaguiElement } from 'tamagui';

const MAX_ANIMATION_DURATION = 550;
export function Content({
  children,
  estimatedContentHeight,
  testID,
}: IDialogContentProps) {
  const isOptimization = !!estimatedContentHeight;
  const [showLoading, changeLoadingVisibility] = useState(isOptimization);
  const [showChildren, changeChildrenVisibility] = useState(!isOptimization);
  const timeRef = useRef(Date.now());
  const ref = useRef<TamaguiElement>(null);
  const pageYRef = useRef(Number.MAX_VALUE);
  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { height } = e.nativeEvent.layout;
      if (platformEnv.isDev) {
        console.log(
          `testID: ${testID || 'unnamed'}, Dialog content Height is ${height}.`,
        );
      }
    },
    [testID],
  );

  const checkMeasureY = useCallback(() => {
    (ref.current as View).measure(
      (
        x: number,
        y: number,
        width: number,
        height: number,
        pageX: number,
        pageY: number,
      ) => {
        setTimeout(() => {
          if (pageY < pageYRef.current) {
            pageYRef.current = pageY;
            checkMeasureY();
          } else {
            if (platformEnv.isDev) {
              const diffTime = Date.now() - timeRef.current;
              if (diffTime > MAX_ANIMATION_DURATION) {
                console.error(
                  `Dialog Animation duration is ${diffTime}ms, please use estimatedContentHeight to reduce animation time.`,
                );
              }
            }
            setTimeout(() => {
              changeChildrenVisibility(true);
            }, 10);
          }
        }, 5);
      },
    );
  }, []);

  const handleChildrenLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height) {
      changeLoadingVisibility(false);
    }
  }, []);

  useEffect(() => {
    if ((platformEnv.isDev || isOptimization) && children) {
      setTimeout(() => {
        checkMeasureY();
      }, 10);
    }
  }, [checkMeasureY, children, isOptimization]);

  if (!children) {
    return null;
  }
  return (
    <YStack
      px="$5"
      pb="$5"
      ref={ref}
      height={estimatedContentHeight}
      onLayout={handleLayout}
    >
      {isOptimization ? (
        <>
          {
            // When height and width are undefined, the initial width and height of Stack are 0,
            //  it needs to be propped open by the content, and the height will be rewritten when the content is completed,
            //   thus ensuring that children are rendered
          }
          <Stack
            height={undefined}
            width={undefined}
            onLayout={handleChildrenLayout}
          >
            {showChildren ? children : null}
          </Stack>
          <AnimatePresence>
            {showLoading ? (
              <Stack
                bg="$bg"
                animation="medium"
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                opacity={1}
                alignContent="center"
                justifyContent="center"
                flex={1}
                exitStyle={{
                  opacity: 0,
                }}
              >
                <Spinner size="large" />
              </Stack>
            ) : null}
          </AnimatePresence>
        </>
      ) : (
        children
      )}
    </YStack>
  );
}
