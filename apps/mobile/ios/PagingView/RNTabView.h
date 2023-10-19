//
//  RNTabView.h
//  OneKeyWallet
//
//  Created by linleiqin on 2022/7/22.
//

#import <UIKit/UIKit.h>
#import "JXCategoryTitleView.h"

NS_ASSUME_NONNULL_BEGIN


@interface RNTabViewModel : UIView

@property(nonatomic,copy)NSString *activeColor;
@property(nonatomic,copy)NSString *backgroundColor;
@property(nonatomic,copy)NSString *inactiveColor;
@property(nonatomic,copy)NSString *indicatorColor;
@property(nonatomic,copy)NSString *bottomLineColor;

@property(nonatomic,assign)CGFloat paddingX;
@property(nonatomic,assign)CGFloat paddingY;
@property(nonatomic,assign)CGFloat itemPaddingX;
@property(nonatomic,assign)CGFloat itemPaddingY;

@property(nonatomic,assign)CGFloat height;
@property(nonatomic,assign)BOOL tabSpaceEqual;
@property(nonatomic,strong)NSDictionary *labelStyle;

@end

@interface RNTabView : UIView<JXCategoryTitleViewDataSource>

@property(nonatomic,strong)RNTabViewModel *model;

@property (nonatomic, strong) JXCategoryTitleView *categoryView;
@property (nonatomic, strong) UIView *bottomLineView;
@property (nonatomic, strong) NSDictionary *tabViewStyle;
@property (nonatomic, strong) NSArray *values;
@property (nonatomic, assign) NSInteger defaultIndex;

- (instancetype)initWithValues:(NSArray *)values tabViewStyle:(NSDictionary *)tabViewStyle;

- (void)reloadData;

@end

NS_ASSUME_NONNULL_END
