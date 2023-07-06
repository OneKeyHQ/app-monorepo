//
//  RNTabView.m
//  OneKeyWallet
//
//  Created by linleiqin on 2022/7/22.
//

#import "RNTabView.h"
#import "JXCategoryIndicatorLineView.h"
#import "UIColor+Hex.h"

@implementation RNTabViewModel

-(instancetype)initWithDictionary:(NSDictionary *)dictionary {
  self = [super init];
  if (self){
    if (dictionary[@"activeColor"]) {
      self.activeColor = dictionary[@"activeColor"];
    }
    if (dictionary[@"inactiveColor"]) {
      self.inactiveColor = dictionary[@"inactiveColor"];
    }
    if (dictionary[@"backgroundColor"]) {
      self.backgroundColor = dictionary[@"backgroundColor"];
    }
    if (dictionary[@"indicatorColor"]) {
      self.indicatorColor = dictionary[@"indicatorColor"];
    }
    if (dictionary[@"paddingX"]) {
      self.paddingX = [dictionary[@"paddingX"] floatValue];
    }
    if (dictionary[@"paddingY"]) {
      self.paddingY = [dictionary[@"paddingY"] floatValue];
    }
    if (dictionary[@"height"]) {
      self.height = [dictionary[@"height"] floatValue];
    }
    if (dictionary[@"labelStyle"]) {
      self.labelStyle = dictionary[@"labelStyle"];
    }
    if (dictionary[@"bottomLineColor"]) {
      self.bottomLineColor = dictionary[@"bottomLineColor"];
    }
  }
  return self;
}

@end

@implementation RNTabView

- (instancetype)initWithValues:(NSArray *)values tabViewStyle:(NSDictionary *)tabViewStyle {
  self = [super init];
  if (self){
    _values = values;
    _tabViewStyle = tabViewStyle;
    _model = [[RNTabViewModel alloc] initWithDictionary:tabViewStyle];
  }
  return self;
}

-(void)setTabViewStyle:(NSDictionary *)tabViewStyle {
  _tabViewStyle = tabViewStyle;
  _model = [[RNTabViewModel alloc] initWithDictionary:tabViewStyle];
}

-(void)setValues:(NSArray *)values {
  _values = values;
}

-(void)setDefaultIndex:(NSInteger)defaultIndex {
  _defaultIndex = defaultIndex;
}

- (void)reloadData {
  [_categoryView removeFromSuperview];
  [_bottomLineView removeFromSuperview];
  _categoryView = nil;
  [self addSubview:self.categoryView];
}

- (void)layoutSubviews {
  [super layoutSubviews];
  CGFloat categoryWidth = CGRectGetWidth(self.bounds) - _model.paddingX * 2;
  _categoryView.frame = CGRectMake(_model.paddingX, 0, CGRectGetWidth(self.bounds) - _model.paddingX * 2, _model.height - 1);
  _categoryView.cellWidth = categoryWidth / self.values.count;
  self.bottomLineView.frame = CGRectMake(_model.paddingX, CGRectGetMaxY(_categoryView.frame), CGRectGetWidth(_categoryView.frame), 1);
}

-(JXCategoryTitleView *)categoryView {
  if (!_categoryView) {
    _categoryView = [[JXCategoryTitleView alloc] init];
    CGFloat categoryWidth = self.frame.size.width - _model.paddingX * 2;
    _categoryView.titles = [self.values valueForKey:@"label"];
    _categoryView.cellSpacing = 0;
    _categoryView.cellWidth = categoryWidth / self.values.count;
    _categoryView.defaultSelectedIndex = self.defaultIndex;
    _categoryView.backgroundColor = [UIColor colorWithHexString:_model.backgroundColor];
    _categoryView.titleColor = [UIColor colorWithHexString:_model.inactiveColor];
    _categoryView.titleFont = [UIFont systemFontOfSize:15 weight:UIFontWeightSemibold];
    if (_model.labelStyle && _model.labelStyle[@"fontFamily"] && _model.labelStyle[@"fontSize"]) {
      _categoryView.titleFont = [UIFont fontWithName:_model.labelStyle[@"fontFamily"] size:[_model.labelStyle[@"fontSize"] floatValue]];
    }
    _categoryView.titleSelectedColor = [UIColor colorWithHexString:_model.activeColor];
    
    JXCategoryIndicatorLineView *lineView = [[JXCategoryIndicatorLineView alloc] init];
    lineView.indicatorHeight = 2;
    lineView.lineScrollOffsetX = 0;
    lineView.indicatorColor = [UIColor colorWithHexString:_model.indicatorColor];
    _categoryView.indicators = @[lineView];
    _categoryView.titleColorGradientEnabled = YES;
    
    [self addSubview:_categoryView];

  }
  return _categoryView;
}

-(UIView *)bottomLineView {
  if (!_bottomLineView) {
    _bottomLineView = [[UIView alloc] init];
    _bottomLineView.backgroundColor = [UIColor colorWithHexString:_model.bottomLineColor];
//    _bottomLineView.backgroundColor = [UIColor yellowColor];
    [self addSubview:_bottomLineView];
  }
  return _bottomLineView;
}
@end
