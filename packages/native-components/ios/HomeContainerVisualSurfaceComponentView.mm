#import "HomeContainerVisualSurfaceComponentView.h"

#import <objc/message.h>
#import <react/renderer/components/OneKeyNativeComponentsSpec/ComponentDescriptors.h>
#import <react/renderer/components/OneKeyNativeComponentsSpec/Props.h>

using namespace facebook::react;

@interface UIView (HomeContainerVisualSlotLayout)
- (nullable UIView *)visualSlotHostViewForKey:(NSString *)key;
- (BOOL)ownsVisualSlotWithScopeKey:(NSString *)scopeKey
                         sessionId:(NSString *)sessionId;
@end

static UIView *FindHomeContainerView(UIView *view)
{
  if ([view respondsToSelector:@selector(visualSlotHostViewForKey:)] &&
      [view respondsToSelector:@selector(ownsVisualSlotWithScopeKey:sessionId:)]) {
    return view;
  }
  for (UIView *child in view.subviews) {
    UIView *match = FindHomeContainerView(child);
    if (match != nil) {
      return match;
    }
  }
  return nil;
}

static NSString *VisualSlotKey(UIView<RCTComponentViewProtocol> *view)
{
  if (![view isKindOfClass:RCTViewComponentView.class]) {
    return nil;
  }
  NSString *nativeId = ((RCTViewComponentView *)view).nativeId;
  if ([nativeId isEqualToString:@"onekey-home-wallet-banner-slot"]) {
    return @"walletBanner";
  }
  if ([nativeId isEqualToString:@"onekey-home-portfolio-empty-slot"]) {
    return @"portfolioEmpty";
  }
  return nil;
}

@implementation HomeContainerVisualSurfaceComponentView {
  NSMutableArray<UIView<RCTComponentViewProtocol> *> *_mountedChildren;
  UIView *_slotParkingView;
  __weak UIView *_engine;
  NSString *_ownerScopeKey;
  NSString *_ownerSessionId;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<OneKeyHomeContainerVisualSurfaceComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps =
        std::make_shared<const OneKeyHomeContainerVisualSurfaceProps>();
    _props = defaultProps;
    _mountedChildren = [NSMutableArray new];
    _slotParkingView = [UIView new];
    _slotParkingView.hidden = YES;
    [self addSubview:_slotParkingView];
    _ownerScopeKey = @"";
    _ownerSessionId = @"";
    self.clipsToBounds = YES;
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
  NSInteger safeIndex = MIN(MAX(index, 0), _mountedChildren.count);
  [_mountedChildren insertObject:childComponentView atIndex:safeIndex];
  [self insertSubview:childComponentView atIndex:MIN(safeIndex, self.subviews.count)];
  [self setNeedsLayout];
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView
                            index:(NSInteger)index
{
  [_mountedChildren removeObject:childComponentView];
  [childComponentView removeFromSuperview];
  [self setNeedsLayout];
}

- (void)updateProps:(Props::Shared const &)props
            oldProps:(Props::Shared const &)oldProps
{
  const auto &newProps =
      *std::static_pointer_cast<OneKeyHomeContainerVisualSurfaceProps const>(props);
  _ownerScopeKey = [NSString stringWithUTF8String:newProps.ownerScopeKey.c_str()];
  _ownerSessionId = [NSString stringWithUTF8String:newProps.ownerSessionId.c_str()];
  [super updateProps:props oldProps:oldProps];
  [self setNeedsLayout];
}

- (void)connectEngineIfNeeded
{
  UIView *nextEngine = nil;
  for (UIView *child in _mountedChildren) {
    if (VisualSlotKey(child) != nil) {
      continue;
    }
    nextEngine = FindHomeContainerView(child);
    if (nextEngine != nil) {
      break;
    }
  }
  if (_engine == nextEngine) {
    return;
  }
  if (_engine != nil) {
    [_engine setValue:nil forKey:@"visualSlotLayoutDidChange"];
  }
  _engine = nextEngine;
  if (_engine != nil) {
    __weak HomeContainerVisualSurfaceComponentView *weakSelf = self;
    void (^layoutCallback)(void) = ^{
      [weakSelf setNeedsLayout];
      [weakSelf layoutIfNeeded];
    };
    [_engine setValue:[layoutCallback copy] forKey:@"visualSlotLayoutDidChange"];
  }
}

- (void)layoutManagedChildren
{
  [self connectEngineIfNeeded];
  UIView *engine = _engine;
  for (UIView<RCTComponentViewProtocol> *child in _mountedChildren) {
    NSString *slotKey = VisualSlotKey(child);
    if (slotKey == nil) {
      child.hidden = NO;
      child.frame = self.bounds;
      continue;
    }

    UIView *hostView = engine == nil
        ? nil
        : ((UIView *(*)(id, SEL, NSString *))objc_msgSend)(
              engine,
              @selector(visualSlotHostViewForKey:),
              slotKey);
    BOOL ownsSlot = engine != nil &&
        ((BOOL (*)(id, SEL, NSString *, NSString *))objc_msgSend)(
            engine,
            @selector(ownsVisualSlotWithScopeKey:sessionId:),
            _ownerScopeKey,
            _ownerSessionId);
    BOOL isVisible = hostView != nil && !hostView.hidden &&
        hostView.bounds.size.width > 0 && hostView.bounds.size.height > 0;
    if (!isVisible) {
      if (child.superview != _slotParkingView) {
        [child removeFromSuperview];
        [_slotParkingView addSubview:child];
      }
      child.hidden = YES;
      child.accessibilityElementsHidden = YES;
      child.userInteractionEnabled = NO;
      child.frame = CGRectZero;
      continue;
    }

    if (child.superview != hostView) {
      [child removeFromSuperview];
      [hostView addSubview:child];
    }
    child.hidden = NO;
    child.accessibilityElementsHidden = !ownsSlot;
    child.userInteractionEnabled = ownsSlot && [slotKey isEqualToString:@"walletBanner"];
    child.frame = hostView.bounds;
    [child setNeedsLayout];
  }
}

- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event
{
  if (!self.userInteractionEnabled || self.hidden || self.alpha <= 0.01) {
    return nil;
  }

  [self layoutManagedChildren];
  UIView *engine = _engine;
  for (UIView<RCTComponentViewProtocol> *child in [_mountedChildren reverseObjectEnumerator]) {
    NSString *slotKey = VisualSlotKey(child);
    if (slotKey == nil || child.hidden || child.alpha <= 0.01) {
      continue;
    }
    CGPoint childPoint = [child convertPoint:point fromView:self];
    if (!CGRectContainsPoint(child.bounds, childPoint)) {
      continue;
    }
    BOOL ownsSlot = engine != nil &&
        ((BOOL (*)(id, SEL, NSString *, NSString *))objc_msgSend)(
            engine,
            @selector(ownsVisualSlotWithScopeKey:sessionId:),
            _ownerScopeKey,
            _ownerSessionId);
    if (!ownsSlot) {
      return self;
    }
    UIView *slotHit = [child hitTest:childPoint withEvent:event];
    if (slotHit != nil) {
      return slotHit;
    }
  }

  return [super hitTest:point withEvent:event];
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  [self layoutManagedChildren];
}

- (void)finalizeUpdates:(RNComponentViewUpdateMask)updateMask
{
  [super finalizeUpdates:updateMask];
  [self setNeedsLayout];
}

- (void)prepareForRecycle
{
  if (_engine != nil) {
    [_engine setValue:nil forKey:@"visualSlotLayoutDidChange"];
  }
  _engine = nil;
  [super prepareForRecycle];
}

@end
