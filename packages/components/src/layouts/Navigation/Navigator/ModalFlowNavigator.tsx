import { memo, useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ETranslations } from '@onekeyhq/shared/src/locale';

import { EPageType } from '../../../hocs';
import { PageTypeContext } from '../../../hocs/PageType/context';
import { useTheme } from '../../../hooks';
import { makeModalStackNavigatorOptions } from '../GlobalScreenOptions';
import createOnBoardingNavigator from '../Modal/createOnBoardingNavigator';
import createWebModalNavigator from '../Modal/createWebModalNavigator';
import createWebViewNavigator from '../Modal/createWebViewNavigator';
import { createStackNavigator } from '../StackNavigator';

import { hasStackNavigatorModal } from './CommonConfig';

import type { ICommonNavigatorConfig, IScreenOptionsInfo } from './types';
import type { IModalNavigationOptions } from '../ScreenProps';
import type { ParamListBase } from '@react-navigation/routers';

export interface IModalFlowNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase,
> extends Omit<ICommonNavigatorConfig<RouteName, P>, 'options'> {
  options?:
    | IModalNavigationOptions
    | ((props: IScreenOptionsInfo<RouteName>) => IModalNavigationOptions);
  translationId?: ETranslations | string;
  shouldPopOnClickBackdrop?: boolean;
  dismissOnOverlayPress?: boolean;
  modalContentMaxHeight?: number;
  modalContentMaxWidth?: number;
  /**
   * Web-only. Skip the modal `scale(0.95) -> scale(1)` transform on
   * **both enter and exit** for this screen and keep only the opacity
   * fade. Setting it on any screen of an inner stack causes the whole
   * navigator instance to opt out (so navigating deeper inside the
   * modal does not re-enable scale for a later modal-on-modal push).
   * Use for popover-like modals where the bouncy easing makes row
   * content visibly jump outward. Ignored on native.
   */
  disableEnterScaleAnimation?: boolean;
}

interface IModalFlowNavigatorProps<
  RouteName extends string,
  P extends ParamListBase,
> {
  config: IModalFlowNavigatorConfig<RouteName, P>[];
  name?: string;
  onMounted?: () => void;
  onUnmounted?: () => void;
}

const ModalStack = hasStackNavigatorModal
  ? createStackNavigator()
  : createWebModalNavigator();

const OnBoardingStack = hasStackNavigatorModal
  ? createStackNavigator()
  : createOnBoardingNavigator();

const WebViewStack = hasStackNavigatorModal
  ? createStackNavigator()
  : createWebViewNavigator();

/**
 * Renders a modal stack navigator with configurable screens and lifecycle hooks.
 *
 * Displays a sequence of modal screens defined by the provided configuration, applying theme and internationalization settings. Optionally invokes lifecycle callbacks when the navigator mounts and unmounts. The navigator adapts its page type context based on the current page type.
 *
 * @param config - Array of modal screen configurations to render in the navigator
 * @param onMounted - Optional callback invoked when the navigator is mounted
 * @param onUnmounted - Optional callback invoked when the navigator is unmounted
 */
function ModalFlowNavigator<RouteName extends string, P extends ParamListBase>({
  config,
  onMounted,
  onUnmounted,
  pageType: pageTypeFromProps,
}: IModalFlowNavigatorProps<RouteName, P> & {
  pageType?: EPageType;
}) {
  const theme = useTheme();
  const bgColor = theme.bgApp.val;
  const titleColor = theme.text.val;
  const intl = useIntl();

  useEffect(() => {
    onMounted?.();
    return () => {
      onUnmounted?.();
    };
  }, [onMounted, onUnmounted]);

  const contextValue = useMemo(
    () => ({
      pageType: pageTypeFromProps || EPageType.modal,
    }),
    [pageTypeFromProps],
  );
  const ModalStackComponent = useMemo(() => {
    if (contextValue.pageType === EPageType.webView) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return WebViewStack;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return contextValue.pageType === EPageType.onboarding ||
      contextValue.pageType === EPageType.fullScreenPush
      ? OnBoardingStack
      : ModalStack;
  }, [contextValue.pageType]);

  const makeScreenOptions = useCallback(
    (optionsInfo: IScreenOptionsInfo<any>) => ({
      ...makeModalStackNavigatorOptions({
        optionsInfo,
        bgColor,
        titleColor,
        pageType: contextValue.pageType,
      }),
    }),
    [bgColor, titleColor, contextValue.pageType],
  );
  return (
    <PageTypeContext.Provider value={contextValue}>
      <ModalStackComponent.Navigator screenOptions={makeScreenOptions}>
        {config.map(
          ({
            name,
            component,
            options,
            translationId,
            shouldPopOnClickBackdrop,
            dismissOnOverlayPress,
            modalContentMaxHeight,
            modalContentMaxWidth,
            disableEnterScaleAnimation,
          }) => {
            // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop
            const customOptions: IModalNavigationOptions = {
              ...(typeof options === 'function' ? {} : options),
              shouldPopOnClickBackdrop,
              dismissOnOverlayPress,
              modalContentMaxHeight,
              modalContentMaxWidth,
              disableEnterScaleAnimation,
              title: translationId
                ? intl.formatMessage({
                    id: translationId as ETranslations,
                  })
                : '',
            };
            return (
              <ModalStack.Screen
                key={`Modal-Flow-${name as string}`}
                name={name}
                component={component}
                options={customOptions}
              />
            );
          },
        )}
      </ModalStackComponent.Navigator>
    </PageTypeContext.Provider>
  );
}

export default memo(ModalFlowNavigator);
