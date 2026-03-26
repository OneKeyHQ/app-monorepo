import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class DialogLayoutScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public termsDialogLayout(params: {
    // screen dimensions
    screenWidth: number;
    screenHeight: number;
    windowWidth: number;
    windowHeight: number;
    // safe area insets
    safeAreaTop: number;
    safeAreaBottom: number;
    safeAreaLeft: number;
    safeAreaRight: number;
    // dialog outer container (outermost Stack)
    outerContainerHeight: number;
    outerContainerWidth: number;
    outerContainerY: number;
    // dialog content area (inner Stack with minHeight)
    contentHeight: number;
    contentWidth: number;
    contentY: number;
    // footer area (YStack with button + disclaimer text)
    footerHeight: number;
    footerWidth: number;
    footerY: number;
    // disclaimer text (bottom XStack)
    disclaimerHeight: number;
    disclaimerWidth: number;
    disclaimerY: number;
    // computed: is disclaimer fully visible?
    disclaimerBottomEdge: number;
    visibleBottomEdge: number;
    isDisclaimerFullyVisible: boolean;
    // pixel ratio
    pixelRatio: number;
    fontScale: number;
    // platform info
    platform: string;
    osVersion: string;
  }) {
    return params;
  }
}
