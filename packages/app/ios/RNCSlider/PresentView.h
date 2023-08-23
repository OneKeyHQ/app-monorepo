//
//  PresentView.h
//  OneKeyWallet
//
//  Created by linleiqin on 2023/8/22.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface PresentViewModel : NSObject

@property(nonatomic,assign)NSInteger lineCount;
@property(nonatomic,assign)CGFloat space;

@end

@interface PresentView : UIView

@property(nonatomic,strong)PresentViewModel *model;

@property(nonatomic,copy)UIColor *minimumTrackColor;
@property(nonatomic,copy)UIColor *maximumTrackColor;
@property(nonatomic) float value;

- (instancetype)initWithStyle:(NSDictionary *)tabViewStyle;

@end

NS_ASSUME_NONNULL_END
