/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#import "RNCSlider.h"
#import "PresentView.h"
#import "UIColor+Hex.h"

@interface RNCSlider ()
@property (nonatomic, strong) PresentView *presentView;
@property(nonatomic,assign)BOOL viewDidHide;
@end

@implementation RNCSlider
{
  float _unclippedValue;
  bool _minimumTrackImageSet;
  bool _maximumTrackImageSet;
}

- (instancetype)initWithFrame:(CGRect)frame
{
	if (self = [super initWithFrame:frame]) {
    self.minimumValue = 100;

  }
	return self;
}

- (void)setValue:(float)value
{
    value = [self discreteValue:value];
  _unclippedValue = value;
  super.value = value;
  [self setupAccessibility:value];
}

-(PresentView *)presentView {
  if(!_presentView) {
    _presentView = [[PresentView alloc] initWithStyle:_presentStyle];
    _presentView.minimumTrackColor = self.minimumTrackTintColor;
    _presentView.maximumTrackColor = self.maximumTrackTintColor;
  }
  return _presentView;
}

-(void)setPresentStyle:(NSDictionary *)presentStyle {
  _presentStyle = presentStyle;
  [self setNeedsDisplay];
}


-(void)setThumbStyle:(NSDictionary *)thumbStyle {
  _thumbStyle = thumbStyle;
  if(thumbStyle[@"size"] && thumbStyle[@"bgColor"] && thumbStyle[@"borderColor"] && thumbStyle[@"borderWidth"]) {
    CGFloat size = [thumbStyle[@"size"] floatValue];
    CGFloat borderWidth = [thumbStyle[@"borderWidth"] floatValue];
    UIColor *bgColor = [UIColor colorWithHexString:thumbStyle[@"bgColor"]];
    UIColor *borderColor = [UIColor colorWithHexString:thumbStyle[@"borderColor"]];
    UIImage *image = [self createImageWithSize:size bgColor:bgColor borderColor:borderColor borderWidth:borderWidth];
    [self setThumbImage:image forState:UIControlStateNormal];
  }
//  [self setThumbImage:[self createImageWithSize:25] forState:UIControlStateHighlighted];
}

- (void)setValue:(float)value animated:(BOOL)animated
{
    value = [self discreteValue:value];
  _unclippedValue = value;
  [super setValue:value animated:animated];
  [self setupAccessibility:value];
  if (_presentView) {
    _presentView.value = value;
  }
}

- (void)setupAccessibility:(float)value
{
  if (self.accessibilityUnits && self.accessibilityIncrements && [self.accessibilityIncrements count] - 1 == (int)self.maximumValue) {
    int index = (int)value;
    NSString *sliderValue = (NSString *)[self.accessibilityIncrements objectAtIndex:index];
    NSUInteger stringLength = [self.accessibilityUnits length];

    NSString *spokenUnits = [NSString stringWithString:self.accessibilityUnits];
    if (sliderValue && [sliderValue intValue] == 1) {
      spokenUnits = [spokenUnits substringToIndex:stringLength-1];
    }
    
    self.accessibilityValue = [NSString stringWithFormat:@"%@ %@", sliderValue, spokenUnits];
  }
}


-(void)setMinimumTrackTintColor:(UIColor *)minimumTrackTintColor {
	super.minimumTrackTintColor = minimumTrackTintColor;
}

- (void)setMinimumValue:(float)minimumValue
{
  super.minimumValue = minimumValue;
  super.value = _unclippedValue;
}

- (void)setMaximumValue:(float)maximumValue
{
  super.maximumValue = maximumValue;
  super.value = _unclippedValue;
}

- (void)setTrackImage:(UIImage *)trackImage
{
  if (trackImage != _trackImage) {
    _trackImage = trackImage;
    CGFloat width = trackImage.size.width / 2;
    if (!_minimumTrackImageSet) {
      UIImage *minimumTrackImage = [trackImage resizableImageWithCapInsets:(UIEdgeInsets){
        0, width, 0, width
      } resizingMode:UIImageResizingModeStretch];
      [self setMinimumTrackImage:minimumTrackImage forState:UIControlStateNormal];
    }
    if (!_maximumTrackImageSet) {
      UIImage *maximumTrackImage = [trackImage resizableImageWithCapInsets:(UIEdgeInsets){
        0, width, 0, width
      } resizingMode:UIImageResizingModeStretch];
      [self setMaximumTrackImage:maximumTrackImage forState:UIControlStateNormal];
    }
  }
}

- (void)setMinimumTrackImage:(UIImage *)minimumTrackImage
{
  _trackImage = nil;
  _minimumTrackImageSet = true;
  minimumTrackImage = [minimumTrackImage resizableImageWithCapInsets:(UIEdgeInsets){
    0, minimumTrackImage.size.width, 0, 0
  } resizingMode:UIImageResizingModeStretch];
  [self setMinimumTrackImage:minimumTrackImage forState:UIControlStateNormal];
}

- (UIImage *)minimumTrackImage
{
  return [self thumbImageForState:UIControlStateNormal];
}

- (void)setMaximumTrackImage:(UIImage *)maximumTrackImage
{
  _trackImage = nil;
  _maximumTrackImageSet = true;
  maximumTrackImage = [maximumTrackImage resizableImageWithCapInsets:(UIEdgeInsets){
    0, 0, 0, maximumTrackImage.size.width
  } resizingMode:UIImageResizingModeStretch];
  [self setMaximumTrackImage:maximumTrackImage forState:UIControlStateNormal];
}

- (UIImage *)maximumTrackImage
{
  return [self thumbImageForState:UIControlStateNormal];
}

- (void)setThumbImage:(UIImage *)thumbImage
{
  [self setThumbImage:thumbImage forState:UIControlStateNormal];
}

- (UIImage *)thumbImage
{
  return [self thumbImageForState:UIControlStateNormal];
}

- (void)setInverted:(BOOL)inverted
{
  if (inverted) {
    self.transform = CGAffineTransformMakeScale(-1, 1);
  } else {
    self.transform = CGAffineTransformMakeScale(1, 1);
  }
}

- (void)setDisabled:(BOOL)disabled
{
    self.enabled = !disabled;
    [self layoutSubviews];
}

- (float)discreteValue:(float)value
{
    if (self.step > 0 && value >= self.maximumValue) {
        return self.maximumValue;
    }

    if (self.step > 0 && self.step <= (self.maximumValue - self.minimumValue)) {
        double (^_round)(double) = ^(double x) {
            if (!UIAccessibilityIsVoiceOverRunning()) {
                return round(x);
            } else if (self.lastValue > value) {
                return floor(x);
            } else {
                return ceil(x);
            }
        };

        return MAX(self.minimumValue,
            MIN(self.maximumValue, self.minimumValue + _round((value - self.minimumValue) / self.step) * self.step)
        );
    }

    return value;
}

//- (CGRect)trackRectForBounds:(CGRect)bounds
//{
//	bounds = [super trackRectForBounds:bounds]; // 必须通过调用父类的trackRectForBounds 获取一个 bounds 值，否则 Autolayout 会失效，UISlider 的位置会跑偏。
//	return CGRectMake(bounds.origin.x, bounds.origin.y, bounds.size.width, 10); // 这里面的h即为你想要设置的高度。
//}


-(void)layoutSubviews {
  [super layoutSubviews];
  if(_presentStyle) {
    UIView *handleView = self.subviews.firstObject;
    if (handleView && handleView.subviews[0]) {
      UIView *tempView = handleView.subviews[0];
      _presentView.frame = CGRectMake(3, tempView.frame.origin.y, self.frame.size.width -6, tempView.frame.size.height);
      [_presentView setNeedsDisplay];
    }
    [self hideNativeViews];
  }
}

- (void)hideNativeViews {
  if(_presentStyle && !_viewDidHide) {
    UIView *handleView = self.subviews.firstObject;
    for (UIView *subView in handleView.subviews) {
      if(![subView isKindOfClass:[UIImageView class]]) {
        subView.hidden = YES;
      }
    }
    _viewDidHide = YES;
  }
}

- (void)showNativeViews {
  if(!_presentStyle) {
    UIView *handleView = self.subviews.firstObject;
    for (UIView *subView in handleView.subviews) {
      if(![subView isKindOfClass:[UIImageView class]]) {
        subView.hidden = NO;
      }
    }
    [self.presentView removeFromSuperview];
    self.presentView = nil;
    _viewDidHide = YES;
  }
}

-(void)drawRect:(CGRect)rect {
  if(self.presentStyle) {
    UIView *handleView = self.subviews.firstObject;
    [handleView insertSubview:self.presentView atIndex:handleView.subviews.count - 1];
    [self setNeedsLayout];
  } else {
    [self showNativeViews];
  }
}

- (UIImage *)createImageWithSize:(CGFloat)size bgColor:(UIColor *)bgColor borderColor:(UIColor *)borderColor borderWidth:(CGFloat)borderWidth {
  UIGraphicsBeginImageContextWithOptions(CGSizeMake(size, size), NO, 0.0);
  CGContextRef context = UIGraphicsGetCurrentContext();

  // Draw a rounded rectangle
  CGFloat cornerRadius = size/2;
  CGRect rect = CGRectMake(borderWidth/2, borderWidth/2, size - borderWidth, size - borderWidth);
  UIBezierPath *path = [UIBezierPath bezierPathWithRoundedRect:rect cornerRadius:cornerRadius];

  // Set the border color and width
  CGContextSetStrokeColorWithColor(context, borderColor.CGColor);
  CGContextSetLineWidth(context, borderWidth);

  // Fill the rectangle with the background color
  CGContextSetFillColorWithColor(context, bgColor.CGColor);

  CGContextAddPath(context, path.CGPath);
  CGContextDrawPath(context, kCGPathFillStroke);

  UIImage *generatedImage = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  return generatedImage;
}


@end
