#import "HomeContainerSurfaceComponentView.h"

#import "HomeContainerSlotComponentView.h"

#import <objc/message.h>
#import <react/renderer/components/OneKeyNativeComponentsSpec/ComponentDescriptors.h>
#import <react/renderer/components/OneKeyNativeComponentsSpec/Props.h>

using namespace facebook::react;

@interface UIView (HomeContainerSlotLayout)
- (UIView *)slotHostViewForKey:(NSString *)key;
- (void)setMountedSlotKeys:(NSArray<NSString *> *)keys;
- (BOOL)ownsSlotWithScopeKey:(NSString *)scopeKey sessionId:(NSString *)sessionId;
@end

static UIView *FindHomeContainerEngine(UIView *view)
{
  if ([view respondsToSelector:@selector(slotHostViewForKey:)] &&
      [view respondsToSelector:@selector(setMountedSlotKeys:)] &&
      [view respondsToSelector:@selector(ownsSlotWithScopeKey:sessionId:)]) {
    return view;
  }
  for (UIView *child in view.subviews) {
    UIView *match = FindHomeContainerEngine(child);
    if (match != nil) {
      return match;
    }
  }
  return nil;
}

@implementation HomeContainerSurfaceComponentView {
  NSMutableArray<UIView<RCTComponentViewProtocol> *> *_mountedChildren;
  __weak UIView *_engine;
  UIView *_slotParkingView;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<OneKeyHomeContainerSurfaceComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps =
        std::make_shared<const OneKeyHomeContainerSurfaceProps>();
    _props = defaultProps;
    _mountedChildren = [NSMutableArray new];
    _slotParkingView = [UIView new];
    _slotParkingView.hidden = YES;
    [self addSubview:_slotParkingView];
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
  if ([childComponentView isKindOfClass:HomeContainerSlotComponentView.class]) {
    [_slotParkingView addSubview:childComponentView];
  } else {
    [self insertSubview:childComponentView atIndex:MIN(safeIndex, self.subviews.count)];
  }
  [self setNeedsLayout];
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView
                            index:(NSInteger)index
{
  [_mountedChildren removeObject:childComponentView];
  [childComponentView removeFromSuperview];
  [self connectEngineIfNeeded];
  [self setNeedsLayout];
}

- (void)connectEngineIfNeeded
{
  UIView *nextEngine = nil;
  for (UIView *child in _mountedChildren) {
    if ([child isKindOfClass:HomeContainerSlotComponentView.class]) {
      continue;
    }
    nextEngine = FindHomeContainerEngine(child);
    if (nextEngine != nil) {
      break;
    }
  }
  if (_engine == nextEngine) {
    return;
  }
  if (_engine != nil) {
    [_engine setValue:nil forKey:@"slotLayoutDidChange"];
  }
  _engine = nextEngine;
  if (_engine != nil) {
    __weak HomeContainerSurfaceComponentView *weakSelf = self;
    void (^layoutCallback)(void) = ^{
      [weakSelf layoutManagedChildren];
    };
    [_engine setValue:[layoutCallback copy] forKey:@"slotLayoutDidChange"];
  }
}

- (NSArray<NSString *> *)presentedSlotKeys
{
  // Presence suppresses native fallback while owner authority is switching.
  NSMutableArray<NSString *> *keys = [NSMutableArray new];
  for (UIView *child in _mountedChildren) {
    if ([child isKindOfClass:HomeContainerSlotComponentView.class]) {
      HomeContainerSlotComponentView *slot =
          (HomeContainerSlotComponentView *)child;
      if (slot.slotKey.length > 0) {
        [keys addObject:slot.slotKey];
      }
    }
  }
  return keys;
}

- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event
{
  if (!self.userInteractionEnabled || self.hidden || self.alpha <= 0.01) {
    return nil;
  }

  [self connectEngineIfNeeded];
  UIView *engine = _engine;
  for (UIView *child in [_mountedChildren reverseObjectEnumerator]) {
    if (![child isKindOfClass:HomeContainerSlotComponentView.class] ||
        child.hidden || child.alpha <= 0.01) {
      continue;
    }
    CGPoint childPoint = [child convertPoint:point fromView:self];
    if (!CGRectContainsPoint(child.bounds, childPoint)) {
      continue;
    }
    HomeContainerSlotComponentView *slot =
        (HomeContainerSlotComponentView *)child;
    BOOL ownsSlot = engine != nil &&
        ((BOOL (*)(id, SEL, NSString *, NSString *))objc_msgSend)(
            engine,
            @selector(ownsSlotWithScopeKey:sessionId:),
            slot.ownerScopeKey,
            slot.ownerSessionId);
    if (!ownsSlot) {
      return self;
    }
    if (!child.userInteractionEnabled) {
      continue;
    }
    UIView *slotHit = [child hitTest:childPoint withEvent:event];
    if (slotHit != nil) {
      return slotHit;
    }
  }

  if (engine != nil && !engine.hidden && engine.userInteractionEnabled) {
    CGPoint enginePoint = [engine convertPoint:point fromView:self];
    UIView *engineHit = [engine hitTest:enginePoint withEvent:event];
    if (engineHit != nil) {
      return engineHit;
    }
  }

  return [super hitTest:point withEvent:event];
}

- (void)layoutManagedChildren
{
  [self connectEngineIfNeeded];
  UIView *engine = _engine;
  if (engine != nil) {
    NSArray<NSString *> *keys = [self presentedSlotKeys];
    ((void (*)(id, SEL, NSArray<NSString *> *))objc_msgSend)(
        engine,
        @selector(setMountedSlotKeys:),
        keys);
  }

  for (UIView *child in _mountedChildren) {
    if (![child isKindOfClass:HomeContainerSlotComponentView.class]) {
      child.hidden = NO;
      child.frame = self.bounds;
      continue;
    }
    HomeContainerSlotComponentView *slot =
        (HomeContainerSlotComponentView *)child;
    if (engine == nil || slot.slotKey.length == 0) {
      if (slot.superview != _slotParkingView) {
        [slot removeFromSuperview];
        [_slotParkingView addSubview:slot];
      }
      slot.hidden = YES;
      slot.accessibilityElementsHidden = YES;
      slot.frame = CGRectZero;
      continue;
    }
    BOOL ownsSlot =
        ((BOOL (*)(id, SEL, NSString *, NSString *))objc_msgSend)(
            engine,
            @selector(ownsSlotWithScopeKey:sessionId:),
            slot.ownerScopeKey,
            slot.ownerSessionId);
    UIView *hostView =
        ((UIView *(*)(id, SEL, NSString *))objc_msgSend)(
            engine,
            @selector(slotHostViewForKey:),
            slot.slotKey);
    BOOL isVisible = hostView != nil && !hostView.hidden &&
        hostView.bounds.size.width > 0 && hostView.bounds.size.height > 0;
    if (!isVisible) {
      if (slot.superview != _slotParkingView) {
        [slot removeFromSuperview];
        [_slotParkingView addSubview:slot];
      }
      slot.hidden = YES;
      slot.accessibilityElementsHidden = YES;
      slot.frame = CGRectZero;
      continue;
    }
    if (slot.superview != hostView) {
      [slot removeFromSuperview];
      [hostView addSubview:slot];
    }
    slot.hidden = NO;
    slot.accessibilityElementsHidden = !ownsSlot;
    slot.frame = hostView.bounds;
    [slot setNeedsLayout];
  }
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
    [_engine setValue:nil forKey:@"slotLayoutDidChange"];
  }
  _engine = nil;
  [super prepareForRecycle];
}

@end
