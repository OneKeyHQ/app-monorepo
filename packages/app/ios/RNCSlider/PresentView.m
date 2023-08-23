//
//  PresentView.m
//  OneKeyWallet
//
//  Created by linleiqin on 2023/8/22.
//

#import "PresentView.h"
#import "UIColor+Hex.h"

@implementation PresentViewModel

- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
  self = [super init];
  if (self){
    if (dictionary[@"lineCount"]) {
      self.lineCount = [dictionary[@"lineCount"] integerValue];
    }
    if (dictionary[@"space"]) {
      self.space = [dictionary[@"space"] floatValue];
    }
  }
  return self;
}
@end


@implementation PresentView

- (instancetype)initWithStyle:(NSDictionary *)style {
  self = [super init];
  if (self){
    self.backgroundColor = [UIColor clearColor];
    self.userInteractionEnabled = NO;
    _model = [[PresentViewModel alloc] initWithDictionary:style];
  }
  return self;
}


-(void)setValue:(float)value {
  _value = value;
  [self setNeedsDisplay];
}

- (void)drawRect:(CGRect)rect {

  CGContextRef context = UIGraphicsGetCurrentContext();
  [self.maximumTrackColor set];
  CGContextAddRect(context, rect);
  CGContextFillPath(context);



  CGContextSetStrokeColorWithColor(context, self.minimumTrackColor.CGColor);
  CGContextSetLineWidth(context, self.bounds.size.height * 2);

  CGPoint startPoint = CGPointMake(0, 0);

  float trickWidth = (self.value / 100) * rect.size.width;
  CGPoint endPoint = CGPointMake(trickWidth, 0);
  CGContextMoveToPoint(context, startPoint.x, startPoint.y);
  CGContextAddLineToPoint(context, endPoint.x, endPoint.y);

   startPoint = CGPointMake(0, 0);
   endPoint = CGPointMake(rect.size.width,0);

  CGContextStrokePath(context);

  context = UIGraphicsGetCurrentContext();

  CGFloat segmentLength = (endPoint.x - startPoint.x + self.model.space) / self.model.lineCount;

  for (int i = 1; i < self.model.lineCount; i++) {
    CGFloat segmentStartX = startPoint.x + i * segmentLength - self.model.space;
    CGContextSetBlendMode(context, kCGBlendModeClear);
    CGRect transparentRect = CGRectMake(segmentStartX, startPoint.y, self.model.space,self.bounds.size.height );
    CGContextAddRect(context, transparentRect);
    CGContextFillPath(context);
  }

  CGContextStrokePath(context);
}



@end
