//
//  RNEventManager.m
//  exponfcdemo
//
//  Created by 林雷钦 on 2021/11/8.
//

#import "OKLiteManager.h"
#import "OKNFCLite.h"


@interface OKLiteManager ()<OKNFCLiteDelegate>

@property(nonatomic,strong)OKNFCLite *lite;

@property(nonatomic,copy)RCTResponseSenderBlock callback;


@end

@implementation OKLiteManager


RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(getLiteInfo:(NSString *)SN callback:(RCTResponseSenderBlock)callback)
{
  OKNFCLite *lite = [[OKNFCLite alloc] init];
  lite.SN = SN;
  lite.delegate = self;
  [lite getLiteInfo];
  _lite = lite;
  self.callback = callback;
}

RCT_EXPORT_METHOD(setMnemonic:(NSString *)mnemonic pin:(NSString *)pin callback:(RCTResponseSenderBlock)callback)
{
  [_lite setMnemonic:mnemonic withPin:pin];
  self.callback = callback;

}

RCT_EXPORT_METHOD(getMnemonicWithPin:(NSString *)pin callback:(RCTResponseSenderBlock)callback)
{
  [_lite getMnemonicWithPin:pin];
  self.callback = callback;
}

RCT_EXPORT_METHOD(backup:(NSString *)SN callback:(RCTResponseSenderBlock)callback)
{
  OKNFCLite *lite = [[OKNFCLite alloc] init];
  lite.SN = SN;
  lite.delegate = self;
  [lite getLiteInfo];
  _lite = lite;
  self.callback = callback;
}

RCT_EXPORT_METHOD(reset:(RCTResponseSenderBlock)callback)
{
  OKNFCLite *lite = [[OKNFCLite alloc] init];
  [lite reset];
  _lite = lite;
  lite.resetCallback = ^(BOOL isSuccess) {
    callback(@[[NSNull null],@(isSuccess)]);
  };
}

- (void)ok_lite:(OKNFCLite *)lite getInfoComplete:(OKNFCLiteStatus)status {
  if (self.callback) {
    NSDictionary *liteInfo = @{
      @"pinRTL":@(lite.pinRTL),
      @"status":@(lite.status),
      @"SN":lite.SN
    };
    self.callback(@[[NSNull null],liteInfo]);
  }
}

- (void)ok_lite:(OKNFCLite *)lite setMnemonicComplete:(OKNFCLiteSetMncStatus)status {
//  if (self.callback) {
//    self.callback(@[[NSNull null],@{@"hello" : @"setMnemonicComplete",}]);
//  }
}


- (void)ok_lite:(OKNFCLite *)lite getMnemonic:(NSString *)mnemonic complete:(OKNFCLiteGetMncStatus)status {
  NSLog(@"getMnemonic %@",mnemonic);
}


@end
