#import "RCTNativeOverlayComponentView.h"

#import <react/renderer/components/RNCNativeOverlay/ComponentDescriptors.h>
#import <react/renderer/components/RNCNativeOverlay/EventEmitters.h>
#import <react/renderer/components/RNCNativeOverlay/Props.h>
#import <react/renderer/components/RNCNativeOverlay/RCTComponentViewHelpers.h>

#import <React/RCTComponent.h>
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTSurfaceTouchHandler.h>

#if __has_include(<NativeOverlay/NativeOverlay-Swift.h>)
#import <NativeOverlay/NativeOverlay-Swift.h>
#elif __has_include("NativeOverlay/NativeOverlay-Swift.h")
#import "NativeOverlay/NativeOverlay-Swift.h"
#else
#import "NativeOverlay-Swift.h"
#endif

using namespace facebook::react;

static NSString *RNCNativeOverlayLevelString(RNCNativeOverlayLevel level)
{
  switch (level) {
    case RNCNativeOverlayLevel::Hardware:
      return @"hardware";
    case RNCNativeOverlayLevel::Secure:
      return @"secure";
    case RNCNativeOverlayLevel::Toast:
      return @"toast";
    case RNCNativeOverlayLevel::Lock:
      return @"lock";
    case RNCNativeOverlayLevel::Debug:
      return @"debug";
    case RNCNativeOverlayLevel::Modal:
    default:
      return @"modal";
  }
}

static NSString *RNCNativeOverlayPresentationString(RNCNativeOverlayPresentation presentation)
{
  switch (presentation) {
    case RNCNativeOverlayPresentation::Toast:
      return @"toast";
    case RNCNativeOverlayPresentation::Fullscreen:
      return @"fullscreen";
    case RNCNativeOverlayPresentation::Sheet:
      return @"sheet";
    case RNCNativeOverlayPresentation::Anchored:
      return @"anchored";
    case RNCNativeOverlayPresentation::Center:
    default:
      return @"center";
  }
}

@implementation RCTNativeOverlayComponentView {
  NativeOverlayContainerView *_containerView;
  RCTSurfaceTouchHandler *_touchHandler;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<RNCNativeOverlayComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const RNCNativeOverlayProps>();
    _props = defaultProps;

    _containerView = [NativeOverlayContainerView new];
    _touchHandler = [RCTSurfaceTouchHandler new];
    _containerView.touchHandler = _touchHandler;
    self.contentView = _containerView;

    __weak auto weakSelf = self;
    _containerView.onPresented = ^(NSDictionary *body) {
      auto strongSelf = weakSelf;
      if (!strongSelf) return;
      auto emitter = std::static_pointer_cast<const RNCNativeOverlayEventEmitter>(strongSelf->_eventEmitter);
      if (!emitter) return;
      NSNumber *stackOrder = body[@"stackOrder"] ?: @0;
      emitter->onPresented({.stackOrder = stackOrder.intValue});
    };
    _containerView.onDismissed = ^(NSDictionary *body) {
      auto strongSelf = weakSelf;
      if (!strongSelf) return;
      auto emitter = std::static_pointer_cast<const RNCNativeOverlayEventEmitter>(strongSelf->_eventEmitter);
      if (!emitter) return;
      NSString *reason = body[@"reason"] ?: @"system";
      emitter->onDismissed({.reason = std::string(reason.UTF8String)});
    };
    _containerView.onRequestDismiss = ^(NSDictionary *body) {
      auto strongSelf = weakSelf;
      if (!strongSelf) return;
      auto emitter = std::static_pointer_cast<const RNCNativeOverlayEventEmitter>(strongSelf->_eventEmitter);
      if (!emitter) return;
      NSString *reason = body[@"reason"] ?: @"back";
      emitter->onRequestDismiss({.reason = std::string(reason.UTF8String)});
    };
  }
  return self;
}

+ (BOOL)shouldBeRecycled
{
  return NO;
}

- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView
                          index:(NSInteger)index
{
  [_containerView insertChild:childComponentView atIndex:index];
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView
                            index:(NSInteger)index
{
  [_containerView removeChild:childComponentView];
  [childComponentView removeFromSuperview];
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newProps = *std::static_pointer_cast<RNCNativeOverlayProps const>(props);

  _containerView.level = RNCNativeOverlayLevelString(newProps.level);
  _containerView.presentation = RNCNativeOverlayPresentationString(newProps.presentation);
  _containerView.scope = newProps.scope == RNCNativeOverlayScope::Page ? @"page" : @"global";
  _containerView.hostKey = [NSString stringWithUTF8String:newProps.hostKey.c_str()];
  _containerView.ownerKey = [NSString stringWithUTF8String:newProps.ownerKey.c_str()];
  _containerView.stackOrder = newProps.stackOrder;
  _containerView.blocking = newProps.blocking;
  _containerView.dismissOnBackPress = newProps.dismissOnBackPress;
  _containerView.dismissOnBackdropPress = newProps.dismissOnBackdropPress;
  _containerView.backdropColor = RCTUIColorFromSharedColor(newProps.backdropColor);
  _containerView.sheetHeight = newProps.sheetHeight;
  _containerView.sheetCornerRadius = newProps.sheetCornerRadius;
  _containerView.showHandle = newProps.showHandle;
  _containerView.sheetBackgroundColor = RCTUIColorFromSharedColor(newProps.sheetBackgroundColor);
  _containerView.dismissOnPanDown = newProps.dismissOnPanDown;
  _containerView.animationConfig = [NSString stringWithUTF8String:newProps.animationConfig.c_str()];
  _containerView.visible = newProps.visible;
  [_containerView commitConfiguration];

  [super updateProps:props oldProps:oldProps];
}

- (void)invalidate
{
  [_containerView invalidate];
  [super invalidate];
}

@end

Class<RCTComponentViewProtocol> RNCNativeOverlayCls(void)
{
  return RCTNativeOverlayComponentView.class;
}
