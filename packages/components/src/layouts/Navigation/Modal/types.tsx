import type {
  IPageNavigationProp,
  IStackNavigationOptions,
} from '../ScreenProps';
import type {
  Descriptor,
  NavigationHelpers,
  ParamListBase,
  Route,
  RouteProp,
} from '@react-navigation/native';

export type IScene = {
  route: Route<string>;
  focused: boolean;
  color?: string;
};

export type IModalNavigationConfig = NonNullable<unknown>;

export type IModalNavigationOptions = IStackNavigationOptions & {
  shouldPopOnClickBackdrop?: boolean;
  dismissOnOverlayPress?: boolean;
  /**
   * Web-only. When true, the modal skips the `scale(0.95) -> scale(1)`
   * transform and keeps only the opacity fade.
   *
   * Despite the `Enter` in the name, this disables the scale on **both
   * enter and exit** — entering opens to `scale(1)` directly, and on
   * exit / push-over the screen fades out without shrinking. The flag
   * also propagates to any inner-stack screen pushed inside the same
   * modal navigator (e.g. AccountSelectorStack -> ExportPrivateKeysPage)
   * so a subsequent modal-on-modal push does not retroactively shrink
   * the underlying screen.
   *
   * Use for modals that visually behave like popovers where the bouncy
   * scale animation makes child elements (avatars, right-edge buttons,
   * etc.) appear to "jump" outward during the overshoot easing.
   *
   * Only consumed by `createWebModalNavigator` (desktop/web). On native,
   * this flag is ignored because the modal uses translateY-based
   * animation instead of scale.
   */
  disableEnterScaleAnimation?: boolean;
  /**
   * Web-only, wide windows. The modal and its backdrop show and hide at
   * once, with no fade or scale, for a screen that draws its own way in and
   * out around them (the desktop Earn guide grows out of its card and goes
   * back into it). Narrow windows keep the slide. Hoisted to the whole inner
   * stack, like `disableEnterScaleAnimation`.
   */
  disableEnterExitAnimation?: boolean;
  /**
   * Web-only, wide windows. Opened over another modal, this one opens and
   * closes as a modal over a page does: at its own size, with the usual
   * fade and scale. The modal under it neither grows into it nor peeks
   * behind it, and dims as a page under the backdrop does (quickly and
   * deeply as this one fades in, so the two don't show through each
   * other), for a modal
   * that covers the one under it (Earn's Pay with token picker over the
   * deposit form). Hoisted to the whole inner stack, like
   * `disableEnterScaleAnimation`.
   */
  disableStackAnimation?: boolean;
};

export type IModalNavigationEventMap = {
  /**
   * Event which fires when the orientation changes while the modal is being displayed.
   * The orientation provided is only 'portrait' or 'landscape'.
   * This event also fires on initial render, regardless of the current orientation.
   * Only supported on iOS.
   */
  orientationChange: {
    data: {
      orientation: 'portrait' | 'landscape';
    };
  };
};

export type IModalNavigationHelpers = NavigationHelpers<
  ParamListBase,
  IModalNavigationEventMap
>;

export type IModalNavigationProp<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = string,
  NavigatorID extends string | undefined = undefined,
> = IPageNavigationProp<
  ParamList,
  RouteName,
  NavigatorID,
  IModalNavigationOptions
>;

export type IModalScreenProps<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = string,
  NavigatorID extends string | undefined = undefined,
> = {
  navigation: IModalNavigationProp<ParamList, RouteName, NavigatorID>;
  route: RouteProp<ParamList, RouteName>;
};

export type IModalDescriptor = Descriptor<
  ParamListBase,
  IModalNavigationProp<ParamListBase>,
  RouteProp<ParamListBase>
>;

export type IModalDescriptorMap = {
  [key: string]: IModalDescriptor;
};
