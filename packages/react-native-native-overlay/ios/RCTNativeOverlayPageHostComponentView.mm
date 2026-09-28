#import "RCTNativeOverlayPageHostComponentView.h"

#import <react/renderer/components/RNCNativeOverlay/ComponentDescriptors.h>
#import <react/renderer/components/RNCNativeOverlay/Props.h>
#import <react/renderer/components/RNCNativeOverlay/RCTComponentViewHelpers.h>

#import <React/RCTComponent.h>
#import <React/RCTFabricComponentsPlugins.h>

#if __has_include(<NativeOverlay/NativeOverlay-Swift.h>)
#import <NativeOverlay/NativeOverlay-Swift.h>
#elif __has_include("NativeOverlay/NativeOverlay-Swift.h")
#import "NativeOverlay/NativeOverlay-Swift.h"
#else
#import "NativeOverlay-Swift.h"
#endif

using namespace facebook::react;

@implementation RCTNativeOverlayPageHostComponentView {
  NativeOverlayPageHostView *_hostView;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<RNCNativeOverlayPageHostComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const RNCNativeOverlayPageHostProps>();
    _props = defaultProps;
    _hostView = [NativeOverlayPageHostView new];
    self.contentView = _hostView;
  }
  return self;
}

+ (BOOL)shouldBeRecycled
{
  return NO;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newProps = *std::static_pointer_cast<RNCNativeOverlayPageHostProps const>(props);
  _hostView.hostKey = [NSString stringWithUTF8String:newProps.hostKey.c_str()];
  [_hostView setSuspendedOwners:[NSString stringWithUTF8String:newProps.suspendedOwners.c_str()]];
  [super updateProps:props oldProps:oldProps];
}

- (void)invalidate
{
  [_hostView invalidate];
  [super invalidate];
}

@end

Class<RCTComponentViewProtocol> RNCNativeOverlayPageHostCls(void)
{
  return RCTNativeOverlayPageHostComponentView.class;
}
