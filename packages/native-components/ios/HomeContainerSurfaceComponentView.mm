#import "HomeContainerSurfaceComponentView.h"

#import "HomeContainerSlotComponentView.h"

#import <objc/message.h>
#import <react/renderer/components/OneKeyNativeComponentsSpec/ComponentDescriptors.h>
#import <react/renderer/components/OneKeyNativeComponentsSpec/Props.h>

using namespace facebook::react;

@interface UIView (HomeContainerSlotLayout)
- (NSValue *)slotFrameForKey:(NSString *)key;
- (void)setMountedSlotKeys:(NSArray<NSString *> *)keys;
- (UIPanGestureRecognizer *)containerInteractionPanGesture;
@end

static UIView *FindHomeContainerEngine(UIView *view)
{
  if ([view respondsToSelector:@selector(slotFrameForKey:)] &&
      [view respondsToSelector:@selector(setMountedSlotKeys:)]) {
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
  __weak UIPanGestureRecognizer *_interactionPan;
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
  [self insertSubview:childComponentView atIndex:safeIndex];
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
  if (_interactionPan.view == self) {
    [self removeGestureRecognizer:_interactionPan];
  }
  _interactionPan = nil;
  if (_engine != nil) {
    [_engine setValue:nil forKey:@"slotLayoutDidChange"];
  }
  _engine = nextEngine;
  if (_engine != nil) {
    UIPanGestureRecognizer *interactionPan =
        ((UIPanGestureRecognizer *(*)(id, SEL))objc_msgSend)(
            _engine,
            @selector(containerInteractionPanGesture));
    if (interactionPan != nil) {
      [self addGestureRecognizer:interactionPan];
      _interactionPan = interactionPan;
    }
    __weak HomeContainerSurfaceComponentView *weakSelf = self;
    void (^layoutCallback)(void) = ^{
      [weakSelf layoutManagedChildren];
    };
    [_engine setValue:[layoutCallback copy] forKey:@"slotLayoutDidChange"];
  }
}

- (NSArray<NSString *> *)mountedSlotKeys
{
  NSMutableArray<NSString *> *keys = [NSMutableArray new];
  for (UIView *child in _mountedChildren) {
    if ([child isKindOfClass:HomeContainerSlotComponentView.class]) {
      NSString *key = ((HomeContainerSlotComponentView *)child).slotKey;
      if (key.length > 0) {
        [keys addObject:key];
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

  for (UIView *child in [_mountedChildren reverseObjectEnumerator]) {
    if (![child isKindOfClass:HomeContainerSlotComponentView.class] ||
        child.hidden || child.alpha <= 0.01 || !child.userInteractionEnabled) {
      continue;
    }
    CGPoint childPoint = [child convertPoint:point fromView:self];
    UIView *slotHit = [child hitTest:childPoint withEvent:event];
    if (slotHit != nil) {
      return slotHit;
    }
  }

  [self connectEngineIfNeeded];
  UIView *engine = _engine;
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
    NSArray<NSString *> *keys = [self mountedSlotKeys];
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
      slot.hidden = YES;
      continue;
    }
    NSValue *frameValue =
        ((NSValue *(*)(id, SEL, NSString *))objc_msgSend)(
            engine,
            @selector(slotFrameForKey:),
            slot.slotKey);
    CGRect frame = frameValue.CGRectValue;
    BOOL isVisible = frame.size.width > 0 && frame.size.height > 0;
    slot.hidden = !isVisible;
    if (isVisible) {
      slot.frame = frame;
      [slot setNeedsLayout];
    }
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
  if (_interactionPan.view == self) {
    [self removeGestureRecognizer:_interactionPan];
  }
  _interactionPan = nil;
  _engine = nil;
  [super prepareForRecycle];
}

@end
