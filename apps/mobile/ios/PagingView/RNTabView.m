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
    if (dictionary[@"activeLabelColor"]) {
      self.activeColor = dictionary[@"activeLabelColor"];
    }
    if (dictionary[@"labelColor"]) {
      self.inactiveColor = dictionary[@"labelColor"];
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
    if (dictionary[@"itemPaddingX"]) {
      self.itemPaddingX = [dictionary[@"itemPaddingX"] floatValue];
    }
    if (dictionary[@"itemPaddingY"]) {
      self.itemPaddingY = [dictionary[@"itemPaddingY"] floatValue];
    }
    if (dictionary[@"height"]) {
      self.height = [dictionary[@"height"] floatValue];
    }
    if (dictionary[@"tabSpaceEqual"]) {
      self.tabSpaceEqual = [dictionary[@"tabSpaceEqual"] boolValue];
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
  CGFloat cellHeight = [self calculateTotalHeight];
  
  if (_model.tabSpaceEqual) {
    CGFloat categoryWidth = CGRectGetWidth(self.bounds) - _model.paddingX * 2;
    _categoryView.frame = CGRectMake(_model.paddingX, 0, categoryWidth, cellHeight - 1);
    _categoryView.cellWidth = categoryWidth / self.values.count;
  } else {
    _categoryView.frame = CGRectMake(_model.paddingX, 0, CGRectGetWidth(self.bounds) - _model.paddingX * 2, cellHeight - 1);
  }
  self.bottomLineView.frame = CGRectMake(_model.paddingX, CGRectGetMaxY(_categoryView.frame), CGRectGetWidth(_categoryView.frame), 1);
}

-(JXCategoryTitleView *)categoryView {
  if (!_categoryView) {
    _categoryView = [[JXCategoryTitleView alloc] init];
    _categoryView.titleDataSource = self;
    CGFloat categoryWidth = self.frame.size.width - _model.paddingX * 2;
    _categoryView.titles = [self.values valueForKey:@"label"];
    _categoryView.defaultSelectedIndex = self.defaultIndex;
    _categoryView.backgroundColor = [UIColor colorWithHexString:_model.backgroundColor];
    _categoryView.titleColor = [UIColor colorWithHexString:_model.inactiveColor];
    _categoryView.titleFont = [UIFont systemFontOfSize:15 weight:UIFontWeightSemibold];
    if (_model.labelStyle && _model.labelStyle[@"fontFamily"] && _model.labelStyle[@"fontSize"]) {
      _categoryView.titleFont = [UIFont fontWithName:_model.labelStyle[@"fontFamily"] size:[_model.labelStyle[@"fontSize"] floatValue]];
    }
    _categoryView.titleSelectedColor = [UIColor colorWithHexString:_model.activeColor];
    _categoryView.cellSpacing = _model.itemPaddingX;
    
    JXCategoryIndicatorLineView *lineView = [[JXCategoryIndicatorLineView alloc] init];
    lineView.indicatorHeight = 2;
    lineView.lineScrollOffsetX = 0;
    lineView.indicatorColor = [UIColor colorWithHexString:_model.indicatorColor];
    if (_model.tabSpaceEqual) {
      _categoryView.cellWidth = categoryWidth / self.values.count;
      _categoryView.averageCellSpacingEnabled = YES;
    } else {
      _categoryView.averageCellSpacingEnabled = NO;
    }
    _categoryView.indicators = @[lineView];
    _categoryView.titleColorGradientEnabled = YES;
    
    [self addSubview:_categoryView];

    CGFloat cellHeight = [self calculateTotalHeight];
  }
  return _categoryView;
}

-(CGFloat)calculateCellHeight {
    CGSize maxSize = CGSizeMake(CGFLOAT_MAX, CGFLOAT_MAX);
    CGSize textSize = [@"Sample" boundingRectWithSize:maxSize options:NSStringDrawingUsesLineFragmentOrigin attributes:@{NSFontAttributeName: _categoryView.titleFont} context:nil].size;
    return textSize.height;
}

-(CGFloat)calculateTotalHeight {
    CGFloat cellHeight = [self calculateCellHeight];
    CGFloat totalHeight = cellHeight + _model.itemPaddingY * 2;
    if (_model.height && _model.height > 0) {
        totalHeight = _model.height;
    }
    return totalHeight;
}

-(CGFloat)categoryTitleView:(JXCategoryTitleView *)titleView widthForTitle:(NSString *)title {
  if (_model.tabSpaceEqual) {
    // 如果tabSpaceEqual为true，返回默认宽度
    CGFloat categoryWidth = CGRectGetWidth(self.bounds) - _model.paddingX * 2;
    return categoryWidth / self.values.count;
  } else {
    // 如果tabSpaceEqual为false，返回根据内容计算的宽度
    CGSize maxSize = CGSizeMake(CGFLOAT_MAX, CGFLOAT_MAX);
    CGSize textSize = [title boundingRectWithSize:maxSize options:NSStringDrawingUsesLineFragmentOrigin attributes:@{NSFontAttributeName: _categoryView.titleFont} context:nil].size;
    return textSize.width;
  }
}

-(UIView *)bottomLineView {
  if (!_bottomLineView) {
    _bottomLineView = [[UIView alloc] init];
    _bottomLineView.backgroundColor = [UIColor colorWithHexString:_model.bottomLineColor];
    [self addSubview:_bottomLineView];
  }
  return _bottomLineView;
}
@end
