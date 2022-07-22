//
//  RNTabView.m
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/7/22.
//

#import "RNTabView.h"
#import "JXCategoryIndicatorBackgroundView.h"
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
  _categoryView = nil;
  [self addSubview:self.categoryView];
}

- (void)layoutSubviews {
  [super layoutSubviews];
  _categoryView.frame = CGRectMake(_model.paddingX, 0, CGRectGetWidth(self.bounds) - _model.paddingX * 2, _model.height);
}

-(JXCategoryTitleView *)categoryView {
  if (!_categoryView) {
    _categoryView = [[JXCategoryTitleView alloc] init];
    CGFloat categoryWidth = self.frame.size.width - 32;
    _categoryView.layer.cornerRadius = 12;
    _categoryView.layer.masksToBounds = YES;
    _categoryView.titles = [self.values valueForKey:@"label"];
    _categoryView.cellSpacing = 0;
    _categoryView.contentEdgeInsetLeft = 2;
    _categoryView.contentEdgeInsetRight = 2;
    _categoryView.cellWidth = (categoryWidth - 4) / self.values.count;
    _categoryView.defaultSelectedIndex = self.defaultIndex;
    _categoryView.titleLabelMaskEnabled = YES;
    _categoryView.backgroundColor = [UIColor colorWithHexString:_model.backgroundColor];
    _categoryView.titleColor = [UIColor colorWithHexString:_model.inactiveColor];
//    if (_model.labelStyle[@"fontFamily"] && _model.labelStyle[@"fontSize"]) {
//      _categoryView.titleFont = [UIFont fontWithName:_model.labelStyle[@"fontFamily"] size:[_model.labelStyle[@"fontSize"] floatValue]];
//    }
    _categoryView.titleFont = [UIFont systemFontOfSize:15 weight:UIFontWeightSemibold];
    _categoryView.titleSelectedColor = [UIColor colorWithHexString:_model.activeColor];
    JXCategoryIndicatorBackgroundView *backgroundView = [[JXCategoryIndicatorBackgroundView alloc] init];
    backgroundView.indicatorHeight = _model.height - 4;
    backgroundView.indicatorCornerRadius = 10;
    backgroundView.indicatorWidthIncrement = 0;
    backgroundView.indicatorColor = [UIColor colorWithHexString:_model.indicatorColor];
    _categoryView.indicators = @[backgroundView];
    
    [self addSubview:self.categoryView];

  }
  return _categoryView;
}

@end
