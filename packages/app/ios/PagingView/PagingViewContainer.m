//
//  PagingViewContainer.m
//  OneKeyWallet
//
//  Created by 林雷钦 on 2022/7/18.
//

#import "PagingViewContainer.h"

#import <React/RCTScrollView.h>
#import <React/RCTRootView.h>
#import <React/RCTRootViewDelegate.h>
#import <React/RCTAppSetupUtils.h>
#import "PagingContainerRootView.h"

@interface PagingViewContainer ()<UIScrollViewDelegate,PagingContainerRootViewDelegate>
@property (nonatomic, copy) void(^scrollCallback)(UIScrollView *scrollView);
@property (nonatomic, assign) NSInteger flag;
@property (nonatomic, strong) PagingContainerRootView *rootView;

@end

@implementation PagingViewContainer

-(instancetype)initWithTag:(NSInteger)flag {
  self = [super init];
  if (self){
    _flag = flag;
  }
  return self;
}

-(void)layoutSubviews {
  [super layoutSubviews];
  
  self.rootView.frame = self.bounds;
//  self.scrollView.frame = self.bounds;
  
}

-(PagingContainerRootView *)rootView {
  if (!_rootView) {
    RCTRootView *mainRootView = (RCTRootView *)[[[[UIApplication sharedApplication] delegate] window] rootViewController].view;
    PagingContainerRootView *view = [[PagingContainerRootView alloc] initWithBridge:mainRootView.bridge
                                                       moduleName:@"PagingViewContrainer"
                                                initialProperties: @{@"data":@(_flag)}];
    view.tag = _flag;
    view.contrainDelegate = self;
    _rootView = view;
    [self addSubview:view];
  }
  return _rootView;
}

-(void)scrollViewDidFind:(RCTScrollView *)rctScrollView {
  self.scrollView = rctScrollView.scrollView;
  self.scrollView.delegate = self;
}

- (void)scrollViewDidScroll:(UIScrollView *)scrollView {
    if (self.scrollCallback != nil) {
        self.scrollCallback(scrollView);
    }
    if (self.listScrollCallback != nil) {
        self.listScrollCallback(scrollView);
    }
}


- (void)listViewDidScrollCallback:(void (^)(UIScrollView *))callback {
  self.scrollCallback = callback;
}

- (UIScrollView *)listScrollView {
    return self.scrollView;
}


- (UIView *)listView {
    return self;
}


@end
