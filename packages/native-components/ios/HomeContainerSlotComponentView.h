#import <React/RCTViewComponentView.h>

NS_ASSUME_NONNULL_BEGIN

@interface HomeContainerSlotComponentView : RCTViewComponentView

@property(nonatomic, copy, readonly) NSString *slotKey;
@property(nonatomic, copy, readonly) NSString *ownerScopeKey;
@property(nonatomic, copy, readonly) NSString *ownerSessionId;
@property(nonatomic, readonly) double slotRevision;
@property(nonatomic, readonly) double producedByStoreCommitId;

@end

NS_ASSUME_NONNULL_END
