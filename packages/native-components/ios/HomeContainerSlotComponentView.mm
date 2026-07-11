#import "HomeContainerSlotComponentView.h"

#import <react/renderer/components/OneKeyNativeComponentsSpec/ComponentDescriptors.h>
#import <react/renderer/components/OneKeyNativeComponentsSpec/Props.h>

using namespace facebook::react;

@implementation HomeContainerSlotComponentView {
  NSMutableArray<UIView<RCTComponentViewProtocol> *> *_mountedChildren;
  NSString *_slotKey;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<OneKeyHomeContainerSlotComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps =
        std::make_shared<const OneKeyHomeContainerSlotProps>();
    _props = defaultProps;
    _mountedChildren = [NSMutableArray new];
    _slotKey = @"";
    self.userInteractionEnabled = YES;
    self.clipsToBounds = YES;
  }
  return self;
}

+ (BOOL)shouldBeRecycled
{
  return NO;
}

- (NSString *)slotKey
{
  return _slotKey;
}

- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView
                          index:(NSInteger)index
{
  NSInteger safeIndex = MIN(MAX(index, 0), _mountedChildren.count);
  [_mountedChildren insertObject:childComponentView atIndex:safeIndex];
  [self insertSubview:childComponentView atIndex:safeIndex];
  [self setNeedsLayout];
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView
                            index:(NSInteger)index
{
  [_mountedChildren removeObject:childComponentView];
  [childComponentView removeFromSuperview];
}

- (void)updateProps:(Props::Shared const &)props
            oldProps:(Props::Shared const &)oldProps
{
  const auto &newProps =
      *std::static_pointer_cast<OneKeyHomeContainerSlotProps const>(props);
  NSString *nextKey = [NSString stringWithUTF8String:newProps.slotKey.c_str()];
  if (![_slotKey isEqualToString:nextKey]) {
    _slotKey = nextKey;
    [self.superview setNeedsLayout];
  }
  [super updateProps:props oldProps:oldProps];
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  for (UIView *child in _mountedChildren) {
    child.frame = self.bounds;
  }
}

- (void)finalizeUpdates:(RNComponentViewUpdateMask)updateMask
{
  [super finalizeUpdates:updateMask];
  [self setNeedsLayout];
  [self.superview setNeedsLayout];
}

@end
