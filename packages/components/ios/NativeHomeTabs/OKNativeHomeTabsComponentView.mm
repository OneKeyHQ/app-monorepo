#ifdef RCT_NEW_ARCH_ENABLED

#import "OKNativeHomeTabsComponentView.h"

#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTViewComponentView.h>

#import <react/renderer/components/OKNativeHomeTabs/ComponentDescriptors.h>
#import <react/renderer/components/OKNativeHomeTabs/EventEmitters.h>
#import <react/renderer/components/OKNativeHomeTabs/Props.h>
#import <react/renderer/components/OKNativeHomeTabs/RCTComponentViewHelpers.h>

using namespace facebook::react;

static NSString *const OKHomeHeaderNativeID = @"ok-home-header";
static NSString *const OKHomeSlotNativeIDPrefix = @"ok-home-slot:";

static NSCache<NSString *, UIImage *> *OKHomeImageCache()
{
  static NSCache<NSString *, UIImage *> *cache;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    cache = [NSCache new];
    cache.countLimit = 128;
  });
  return cache;
}

static NSString *OKStringFromStdString(const std::string &value)
{
  return [NSString stringWithUTF8String:value.c_str()];
}

static std::string OKStdStringFromNSString(NSString *value)
{
  return value ? std::string(value.UTF8String) : std::string();
}

static OKNativeHomeTabsEventEmitter::OnTabChangeSource OKTabChangeSourceFromNSString(NSString *value)
{
  if ([value isEqualToString:@"swipe"]) {
    return OKNativeHomeTabsEventEmitter::OnTabChangeSource::Swipe;
  }
  if ([value isEqualToString:@"programmatic"]) {
    return OKNativeHomeTabsEventEmitter::OnTabChangeSource::Programmatic;
  }
  return OKNativeHomeTabsEventEmitter::OnTabChangeSource::Tap;
}

@interface OKNativeHomeTabsRowCell : UICollectionViewCell
@property (nonatomic, strong) UIStackView *textStack;
@property (nonatomic, strong) UIStackView *tokenStack;
@property (nonatomic, strong) UILabel *titleLabel;
@property (nonatomic, strong) UILabel *subtitleLabel;
@property (nonatomic, strong) UIView *tokenIconContainer;
@property (nonatomic, strong) UIImageView *tokenIconImageView;
@property (nonatomic, strong) UILabel *tokenIconLabel;
@property (nonatomic, strong) UILabel *tokenTitleLabel;
@property (nonatomic, strong) UILabel *tokenDetailLabel;
@property (nonatomic, strong) UILabel *tokenBalanceLabel;
@property (nonatomic, strong) UILabel *tokenValueLabel;
@property (nonatomic, copy) NSString *currentIconURI;
- (void)configureWithRow:(NSDictionary *)row;
- (void)prepareForSlotWithEstimatedHeight:(CGFloat)height;
@end

@implementation OKNativeHomeTabsRowCell

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    self.contentView.backgroundColor = UIColor.systemBackgroundColor;
    self.contentView.clipsToBounds = NO;

    _textStack = [UIStackView new];
    _textStack.axis = UILayoutConstraintAxisVertical;
    _textStack.spacing = 4;
    _textStack.layoutMargins = UIEdgeInsetsMake(12, 20, 12, 20);
    _textStack.layoutMarginsRelativeArrangement = YES;
    _textStack.translatesAutoresizingMaskIntoConstraints = NO;

    _titleLabel = [UILabel new];
    _titleLabel.numberOfLines = 1;
    _titleLabel.textColor = UIColor.labelColor;

    _subtitleLabel = [UILabel new];
    _subtitleLabel.numberOfLines = 1;
    _subtitleLabel.textColor = UIColor.secondaryLabelColor;

    [_textStack addArrangedSubview:_titleLabel];
    [_textStack addArrangedSubview:_subtitleLabel];
    [self.contentView addSubview:_textStack];

    _tokenStack = [UIStackView new];
    _tokenStack.axis = UILayoutConstraintAxisHorizontal;
    _tokenStack.alignment = UIStackViewAlignmentCenter;
    _tokenStack.spacing = 12;
    _tokenStack.layoutMargins = UIEdgeInsetsMake(10, 20, 10, 20);
    _tokenStack.layoutMarginsRelativeArrangement = YES;
    _tokenStack.translatesAutoresizingMaskIntoConstraints = NO;
    _tokenStack.hidden = YES;

    _tokenIconContainer = [UIView new];
    _tokenIconContainer.clipsToBounds = YES;
    _tokenIconContainer.layer.cornerRadius = 22;
    [_tokenIconContainer.widthAnchor constraintEqualToConstant:44].active = YES;
    [_tokenIconContainer.heightAnchor constraintEqualToConstant:44].active = YES;

    _tokenIconImageView = [UIImageView new];
    _tokenIconImageView.contentMode = UIViewContentModeScaleAspectFill;
    _tokenIconImageView.translatesAutoresizingMaskIntoConstraints = NO;
    _tokenIconImageView.hidden = YES;
    [_tokenIconContainer addSubview:_tokenIconImageView];

    _tokenIconLabel = [UILabel new];
    _tokenIconLabel.textAlignment = NSTextAlignmentCenter;
    _tokenIconLabel.font = [UIFont systemFontOfSize:18 weight:UIFontWeightSemibold];
    _tokenIconLabel.textColor = UIColor.whiteColor;
    _tokenIconLabel.translatesAutoresizingMaskIntoConstraints = NO;
    [_tokenIconContainer addSubview:_tokenIconLabel];

    UIStackView *tokenTextStack = [UIStackView new];
    tokenTextStack.axis = UILayoutConstraintAxisVertical;
    tokenTextStack.spacing = 2;

    _tokenTitleLabel = [UILabel new];
    _tokenTitleLabel.numberOfLines = 1;
    _tokenTitleLabel.lineBreakMode = NSLineBreakByTruncatingTail;
    _tokenTitleLabel.textColor = UIColor.labelColor;
    _tokenTitleLabel.font = [UIFont systemFontOfSize:17 weight:UIFontWeightSemibold];

    _tokenDetailLabel = [UILabel new];
    _tokenDetailLabel.numberOfLines = 1;
    _tokenDetailLabel.lineBreakMode = NSLineBreakByTruncatingTail;
    _tokenDetailLabel.textColor = UIColor.secondaryLabelColor;
    _tokenDetailLabel.font = [UIFont systemFontOfSize:14 weight:UIFontWeightRegular];

    [tokenTextStack addArrangedSubview:_tokenTitleLabel];
    [tokenTextStack addArrangedSubview:_tokenDetailLabel];

    UIStackView *tokenValueStack = [UIStackView new];
    tokenValueStack.axis = UILayoutConstraintAxisVertical;
    tokenValueStack.alignment = UIStackViewAlignmentTrailing;
    tokenValueStack.spacing = 2;
    [tokenValueStack setContentHuggingPriority:UILayoutPriorityRequired forAxis:UILayoutConstraintAxisHorizontal];
    [tokenValueStack setContentCompressionResistancePriority:UILayoutPriorityRequired forAxis:UILayoutConstraintAxisHorizontal];

    _tokenBalanceLabel = [UILabel new];
    _tokenBalanceLabel.numberOfLines = 1;
    _tokenBalanceLabel.textAlignment = NSTextAlignmentRight;
    _tokenBalanceLabel.lineBreakMode = NSLineBreakByTruncatingTail;
    _tokenBalanceLabel.textColor = UIColor.labelColor;
    _tokenBalanceLabel.font = [UIFont systemFontOfSize:17 weight:UIFontWeightRegular];

    _tokenValueLabel = [UILabel new];
    _tokenValueLabel.numberOfLines = 1;
    _tokenValueLabel.textAlignment = NSTextAlignmentRight;
    _tokenValueLabel.lineBreakMode = NSLineBreakByTruncatingTail;
    _tokenValueLabel.textColor = UIColor.secondaryLabelColor;
    _tokenValueLabel.font = [UIFont systemFontOfSize:14 weight:UIFontWeightRegular];

    [tokenValueStack addArrangedSubview:_tokenBalanceLabel];
    [tokenValueStack addArrangedSubview:_tokenValueLabel];

    [_tokenStack addArrangedSubview:_tokenIconContainer];
    [_tokenStack addArrangedSubview:tokenTextStack];
    [_tokenStack addArrangedSubview:tokenValueStack];
    [self.contentView addSubview:_tokenStack];

    [NSLayoutConstraint activateConstraints:@[
      [_textStack.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor],
      [_textStack.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor],
      [_textStack.topAnchor constraintEqualToAnchor:self.contentView.topAnchor],
      [_textStack.bottomAnchor constraintEqualToAnchor:self.contentView.bottomAnchor],
      [_tokenStack.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor],
      [_tokenStack.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor],
      [_tokenStack.topAnchor constraintEqualToAnchor:self.contentView.topAnchor],
      [_tokenStack.bottomAnchor constraintEqualToAnchor:self.contentView.bottomAnchor],
      [_tokenIconImageView.leadingAnchor constraintEqualToAnchor:_tokenIconContainer.leadingAnchor],
      [_tokenIconImageView.trailingAnchor constraintEqualToAnchor:_tokenIconContainer.trailingAnchor],
      [_tokenIconImageView.topAnchor constraintEqualToAnchor:_tokenIconContainer.topAnchor],
      [_tokenIconImageView.bottomAnchor constraintEqualToAnchor:_tokenIconContainer.bottomAnchor],
      [_tokenIconLabel.leadingAnchor constraintEqualToAnchor:_tokenIconContainer.leadingAnchor],
      [_tokenIconLabel.trailingAnchor constraintEqualToAnchor:_tokenIconContainer.trailingAnchor],
      [_tokenIconLabel.topAnchor constraintEqualToAnchor:_tokenIconContainer.topAnchor],
      [_tokenIconLabel.bottomAnchor constraintEqualToAnchor:_tokenIconContainer.bottomAnchor],
    ]];
  }

  return self;
}

- (void)prepareForReuse
{
  [super prepareForReuse];
  for (UIView *view in self.contentView.subviews.copy) {
    if (view != _textStack && view != _tokenStack) {
      [view removeFromSuperview];
    }
  }
  _textStack.hidden = NO;
  _tokenStack.hidden = YES;
  _tokenIconImageView.image = nil;
  _tokenIconImageView.hidden = YES;
  _tokenIconLabel.hidden = NO;
  _currentIconURI = nil;
  self.contentView.frame = self.bounds;
}

- (void)configureWithRow:(NSDictionary *)row
{
  NSString *type = [row[@"type"] isKindOfClass:NSString.class] ? row[@"type"] : @"text";
  if ([type isEqualToString:@"token"] || [type isEqualToString:@"defi"] || [type isEqualToString:@"nft"] || [type isEqualToString:@"history"]) {
    [self configureTokenWithRow:row];
    return;
  }

  NSString *title = [self titleForRow:row type:type];
  NSString *subtitle = [self subtitleForRow:row type:type];

  _textStack.hidden = NO;
  _tokenStack.hidden = YES;
  _titleLabel.text = title ?: type;
  _titleLabel.font = [type isEqualToString:@"sectionHeader"]
    ? [UIFont systemFontOfSize:20 weight:UIFontWeightSemibold]
    : [UIFont systemFontOfSize:16 weight:UIFontWeightMedium];
  _subtitleLabel.text = subtitle;
  _subtitleLabel.hidden = subtitle.length == 0;
  _subtitleLabel.font = [UIFont systemFontOfSize:14 weight:UIFontWeightRegular];
}

- (void)prepareForSlotWithEstimatedHeight:(CGFloat)height
{
  _textStack.hidden = YES;
  _tokenStack.hidden = YES;
  CGRect frame = self.contentView.frame;
  frame.size.height = MAX(height, 1);
  self.contentView.frame = frame;
}

- (void)configureTokenWithRow:(NSDictionary *)row
{
  _textStack.hidden = YES;
  _tokenStack.hidden = NO;

  NSString *type = [row[@"type"] isKindOfClass:NSString.class] ? row[@"type"] : @"text";
  NSString *symbol = [type isEqualToString:@"token"]
    ? [self stringValueForKey:@"symbol" row:row fallback:@"Token"]
    : [self stringValueForKey:@"title" row:row fallback:type];
  NSString *name = [type isEqualToString:@"token"]
    ? [self stringValueForKey:@"name" row:row fallback:nil]
    : [self stringValueForKey:@"subtitle" row:row fallback:nil];
  NSString *price = [type isEqualToString:@"token"] ? [self stringValueForKey:@"price" row:row fallback:nil] : nil;
  NSString *change24h = [type isEqualToString:@"token"] ? [self stringValueForKey:@"change24h" row:row fallback:nil] : nil;
  NSString *networkName = [self stringValueForKey:@"networkName" row:row fallback:nil];
  NSString *balance = [type isEqualToString:@"token"]
    ? [self stringValueForKey:@"balance" row:row fallback:@""]
    : [self stringValueForKey:@"value" row:row fallback:@""];
  NSString *fiatValue = [type isEqualToString:@"token"]
    ? [self stringValueForKey:@"fiatValue" row:row fallback:@""]
    : [self stringValueForKey:@"status" row:row fallback:@""];
  NSString *iconURI = [type isEqualToString:@"nft"]
    ? [self stringValueForKey:@"imageUri" row:row fallback:nil]
    : [self stringValueForKey:@"iconUri" row:row fallback:nil];
  NSString *change24hColor = [self stringValueForKey:@"change24hColor" row:row fallback:@"neutral"];

  [self bindIconWithURI:iconURI fallback:symbol];
  _tokenTitleLabel.text = symbol;
  _tokenBalanceLabel.text = balance;
  _tokenValueLabel.text = fiatValue;

  NSMutableArray<NSString *> *parts = [NSMutableArray array];
  for (NSString *value in @[ name ?: @"", price ?: @"", change24h ?: @"", networkName ?: @"" ]) {
    if (value.length > 0) {
      [parts addObject:value];
    }
  }
  _tokenDetailLabel.text = [parts componentsJoinedByString:@"  "];
  _tokenDetailLabel.textColor = [self changeColorForValue:change24hColor];
}

- (void)bindIconWithURI:(NSString *)iconURI fallback:(NSString *)fallback
{
  _currentIconURI = iconURI ?: @"";
  _tokenIconLabel.text = fallback.length > 0 ? [[fallback substringToIndex:1] uppercaseString] : @"";
  _tokenIconLabel.backgroundColor = [self avatarBackgroundColorForSymbol:fallback];
  _tokenIconImageView.hidden = YES;
  _tokenIconImageView.image = nil;
  _tokenIconLabel.hidden = NO;

  if (iconURI.length == 0 || ![iconURI hasPrefix:@"http"]) {
    return;
  }

  UIImage *cachedImage = [OKHomeImageCache() objectForKey:iconURI];
  if (cachedImage) {
    _tokenIconImageView.image = cachedImage;
    _tokenIconImageView.hidden = NO;
    _tokenIconLabel.hidden = YES;
    return;
  }

  NSURL *url = [NSURL URLWithString:iconURI];
  if (!url) {
    return;
  }
  __weak OKNativeHomeTabsRowCell *weakSelf = self;
  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error || data.length == 0) {
      return;
    }
    UIImage *image = [UIImage imageWithData:data];
    if (!image) {
      return;
    }
    [OKHomeImageCache() setObject:image forKey:iconURI];
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong OKNativeHomeTabsRowCell *strongSelf = weakSelf;
      if (!strongSelf || ![strongSelf.currentIconURI isEqualToString:iconURI]) {
        return;
      }
      strongSelf.tokenIconImageView.image = image;
      strongSelf.tokenIconImageView.hidden = NO;
      strongSelf.tokenIconLabel.hidden = YES;
    });
  }];
  [task resume];
}

- (NSString *)stringValueForKey:(NSString *)key row:(NSDictionary *)row fallback:(NSString *)fallback
{
  NSString *value = [row[key] isKindOfClass:NSString.class] ? row[key] : nil;
  return value.length > 0 ? value : fallback;
}

- (UIColor *)changeColorForValue:(NSString *)value
{
  if ([value isEqualToString:@"positive"]) {
    return [UIColor colorWithRed:0 green:0.5 blue:0.38 alpha:1];
  }
  if ([value isEqualToString:@"negative"]) {
    return [UIColor colorWithRed:0.9 green:0 blue:0.14 alpha:1];
  }
  return UIColor.secondaryLabelColor;
}

- (UIColor *)avatarBackgroundColorForSymbol:(NSString *)symbol
{
  NSArray<UIColor *> *colors = @[
    [UIColor colorWithRed:0.26 green:0.52 blue:0.96 alpha:1],
    [UIColor colorWithRed:0.98 green:0.74 blue:0.02 alpha:1],
    [UIColor colorWithRed:0.2 green:0.66 blue:0.33 alpha:1],
    [UIColor colorWithRed:0.92 green:0.26 blue:0.21 alpha:1],
    [UIColor colorWithRed:0.4 green:0.23 blue:0.72 alpha:1],
  ];
  NSUInteger seed = 0;
  for (NSUInteger index = 0; index < symbol.length; index += 1) {
    seed += [symbol characterAtIndex:index];
  }
  return colors[seed % colors.count];
}

- (NSString *)titleForRow:(NSDictionary *)row type:(NSString *)type
{
  if ([type isEqualToString:@"token"]) {
    return [row[@"symbol"] isKindOfClass:NSString.class] ? row[@"symbol"] : @"Token";
  }
  if ([type isEqualToString:@"history"]) {
    return [row[@"title"] isKindOfClass:NSString.class] ? row[@"title"] : @"History";
  }
  if ([type isEqualToString:@"defi"]) {
    return [row[@"title"] isKindOfClass:NSString.class] ? row[@"title"] : @"DeFi";
  }
  if ([type isEqualToString:@"loading"]) {
    return @"Loading";
  }
  return [row[@"title"] isKindOfClass:NSString.class] ? row[@"title"] : type;
}

- (NSString *)subtitleForRow:(NSDictionary *)row type:(NSString *)type
{
  if ([type isEqualToString:@"token"]) {
    NSMutableArray<NSString *> *parts = [NSMutableArray array];
    for (NSString *key in @[ @"balance", @"fiatValue", @"change24h" ]) {
      NSString *value = [row[key] isKindOfClass:NSString.class] ? row[key] : nil;
      if (value.length > 0) {
        [parts addObject:value];
      }
    }
    return [parts componentsJoinedByString:@"  "];
  }
  if ([type isEqualToString:@"history"]) {
    NSMutableArray<NSString *> *parts = [NSMutableArray array];
    for (NSString *key in @[ @"subtitle", @"value" ]) {
      NSString *value = [row[key] isKindOfClass:NSString.class] ? row[key] : nil;
      if (value.length > 0) {
        [parts addObject:value];
      }
    }
    return [parts componentsJoinedByString:@"  "];
  }
  return [row[@"subtitle"] isKindOfClass:NSString.class] ? row[@"subtitle"] : nil;
}

@end

@interface OKNativeHomeTabsComponentView () <
  RCTOKNativeHomeTabsViewProtocol,
  UICollectionViewDataSource,
  UICollectionViewDelegateFlowLayout,
  UIScrollViewDelegate
>
@end

@implementation OKNativeHomeTabsComponentView {
  UIView *_rootView;
  UICollectionView *_collectionView;
  UIRefreshControl *_refreshControl;
  UIView *_headerContainer;
  UIStackView *_tabBar;
  NSMutableArray<UIView *> *_reactChildren;
  NSMutableDictionary<NSString *, UIView *> *_slotViews;
  NSDictionary *_schema;
  NSArray<NSDictionary *> *_tabs;
  NSArray<NSDictionary *> *_activeRows;
  NSString *_activeTabKey;
  CGFloat _topInset;
  CGFloat _bottomInset;
  CGFloat _initialHeaderHeight;
  NSInteger _lastEndReachedItemCount;
  NSString *_lastVisibleRowsJson;
  BOOL _enableHorizontalSwipe;
  UISwipeGestureRecognizer *_swipeLeftGesture;
  UISwipeGestureRecognizer *_swipeRightGesture;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<OKNativeHomeTabsComponentDescriptor>();
}

+ (BOOL)shouldBeRecycled
{
  return NO;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const OKNativeHomeTabsProps>();
    _props = defaultProps;

    _reactChildren = [NSMutableArray array];
    _slotViews = [NSMutableDictionary dictionary];
    _tabs = @[];
    _activeRows = @[];
    _activeTabKey = @"portfolio";
    _initialHeaderHeight = 312;
    _lastEndReachedItemCount = -1;
    _lastVisibleRowsJson = @"";

    _rootView = [UIView new];
    _rootView.backgroundColor = UIColor.systemBackgroundColor;
    _rootView.clipsToBounds = YES;

    UICollectionViewFlowLayout *layout = [UICollectionViewFlowLayout new];
    layout.scrollDirection = UICollectionViewScrollDirectionVertical;
    layout.minimumLineSpacing = 0;
    layout.minimumInteritemSpacing = 0;

    _collectionView = [[UICollectionView alloc] initWithFrame:CGRectZero collectionViewLayout:layout];
    _collectionView.backgroundColor = UIColor.systemBackgroundColor;
    _collectionView.alwaysBounceVertical = YES;
    _collectionView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
    _collectionView.dataSource = self;
    _collectionView.delegate = self;
    _collectionView.clipsToBounds = NO;
    [_collectionView registerClass:OKNativeHomeTabsRowCell.class forCellWithReuseIdentifier:@"row"];

    _refreshControl = [UIRefreshControl new];
    [_refreshControl addTarget:self action:@selector(handleRefreshControl) forControlEvents:UIControlEventValueChanged];
    _collectionView.refreshControl = _refreshControl;

    _headerContainer = [UIView new];
    _headerContainer.backgroundColor = UIColor.systemBackgroundColor;
    _headerContainer.clipsToBounds = NO;

    _tabBar = [UIStackView new];
    _tabBar.axis = UILayoutConstraintAxisHorizontal;
    _tabBar.spacing = 12;
    _tabBar.alignment = UIStackViewAlignmentCenter;
    _tabBar.distribution = UIStackViewDistributionFill;
    _tabBar.layoutMargins = UIEdgeInsetsMake(8, 16, 8, 16);
    _tabBar.layoutMarginsRelativeArrangement = YES;
    _tabBar.backgroundColor = UIColor.systemBackgroundColor;

    [_rootView addSubview:_collectionView];
    [_rootView addSubview:_headerContainer];
    [_rootView addSubview:_tabBar];

    _swipeLeftGesture = [[UISwipeGestureRecognizer alloc] initWithTarget:self action:@selector(handleSwipe:)];
    _swipeLeftGesture.direction = UISwipeGestureRecognizerDirectionLeft;
    _swipeRightGesture = [[UISwipeGestureRecognizer alloc] initWithTarget:self action:@selector(handleSwipe:)];
    _swipeRightGesture.direction = UISwipeGestureRecognizerDirectionRight;
    [_rootView addGestureRecognizer:_swipeLeftGesture];
    [_rootView addGestureRecognizer:_swipeRightGesture];
    [self syncSwipeEnabled];

    self.contentView = _rootView;
  }

  return self;
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  _rootView.frame = self.bounds;
  _collectionView.frame = _rootView.bounds;
  [self updateOverlayFrames];
  [self syncCollectionInsets];
}

- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView index:(NSInteger)index
{
  [_reactChildren insertObject:childComponentView atIndex:MIN(index, (NSInteger)_reactChildren.count)];
  [self attachReactChild:childComponentView];
  [self setNeedsLayout];
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView index:(NSInteger)index
{
  [_reactChildren removeObject:childComponentView];
  NSString *nativeID = [self nativeIDForChild:childComponentView];
  if ([nativeID hasPrefix:OKHomeSlotNativeIDPrefix]) {
    NSString *slotID = [nativeID substringFromIndex:OKHomeSlotNativeIDPrefix.length];
    [_slotViews removeObjectForKey:slotID];
  }
  [childComponentView removeFromSuperview];
  [self setNeedsLayout];
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &oldViewProps = *std::static_pointer_cast<OKNativeHomeTabsProps const>(_props);
  const auto &newViewProps = *std::static_pointer_cast<OKNativeHomeTabsProps const>(props);

  if (oldViewProps.schemaJson != newViewProps.schemaJson) {
    [self applySchemaJson:OKStringFromStdString(newViewProps.schemaJson)];
  }

  _topInset = newViewProps.topInset;
  _bottomInset = newViewProps.bottomInset;
  _initialHeaderHeight = newViewProps.initialHeaderHeight;
  _enableHorizontalSwipe = newViewProps.enableHorizontalSwipe;
  [self syncSwipeEnabled];
  [self setNeedsLayout];

  [super updateProps:props oldProps:oldProps];
}

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
  RCTOKNativeHomeTabsHandleCommand(self, commandName, args);
}

- (void)scrollToTop:(NSString *)tabKey animated:(BOOL)animated
{
  CGPoint offset = CGPointMake(0, -_collectionView.contentInset.top);
  [_collectionView setContentOffset:offset animated:animated];
}

- (void)switchTab:(NSString *)tabKey animated:(BOOL)animated
{
  [self setActiveTabKey:tabKey source:@"programmatic"];
}

- (void)applyPatch:(NSString *)patchJson
{
  NSData *data = [patchJson dataUsingEncoding:NSUTF8StringEncoding];
  NSError *error = nil;
  id json = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:&error] : nil;
  if (![json isKindOfClass:NSDictionary.class]) {
    [self emitNativeError:@"patch_parse_error" message:error.localizedDescription ?: @"Invalid NativeHomeTabs patch"];
    return;
  }
  _schema = [self dictionaryByMergingBase:_schema ?: @{} patch:json];
  [self applyCurrentSchemaPreservingActiveTab:YES];
}

- (void)endRefreshing:(NSString *)tabKey
{
  [_refreshControl endRefreshing];
}

- (NSInteger)collectionView:(UICollectionView *)collectionView numberOfItemsInSection:(NSInteger)section
{
  return _activeRows.count;
}

- (__kindof UICollectionViewCell *)collectionView:(UICollectionView *)collectionView
                          cellForItemAtIndexPath:(NSIndexPath *)indexPath
{
  OKNativeHomeTabsRowCell *cell = [collectionView dequeueReusableCellWithReuseIdentifier:@"row" forIndexPath:indexPath];
  NSDictionary *row = _activeRows[indexPath.item];
  NSString *type = [row[@"type"] isKindOfClass:NSString.class] ? row[@"type"] : @"text";
  if ([type isEqualToString:@"rnSlot"]) {
    [cell prepareForSlotWithEstimatedHeight:[self estimatedHeightForRow:row]];
    [self attachSlotForRow:row toCell:cell];
  } else {
    [cell configureWithRow:row];
  }
  return cell;
}

- (CGSize)collectionView:(UICollectionView *)collectionView
                  layout:(UICollectionViewLayout *)collectionViewLayout
  sizeForItemAtIndexPath:(NSIndexPath *)indexPath
{
  NSDictionary *row = _activeRows[indexPath.item];
  return CGSizeMake(collectionView.bounds.size.width, [self estimatedHeightForRow:row]);
}

- (void)collectionView:(UICollectionView *)collectionView didSelectItemAtIndexPath:(NSIndexPath *)indexPath
{
  NSDictionary *row = _activeRows[indexPath.item];
  NSString *rowKey = [row[@"key"] isKindOfClass:NSString.class] ? row[@"key"] : @"";
  NSString *rowType = [row[@"type"] isKindOfClass:NSString.class] ? row[@"type"] : @"text";
  [self emitRowPress:rowKey rowType:rowType];
}

- (void)scrollViewDidScroll:(UIScrollView *)scrollView
{
  [self updateOverlayFrames];
  [self maybeEmitEndReached];
  [self maybeEmitVisibleRows];
}

- (void)handleRefreshControl
{
  [self emitRefresh];
}

- (void)handleSwipe:(UISwipeGestureRecognizer *)gesture
{
  NSInteger direction = gesture.direction == UISwipeGestureRecognizerDirectionLeft ? 1 : -1;
  [self switchToAdjacentTab:direction];
}

- (void)applySchemaJson:(NSString *)schemaJson
{
  NSData *data = [schemaJson dataUsingEncoding:NSUTF8StringEncoding];
  NSError *error = nil;
  id json = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:&error] : nil;
  if (![json isKindOfClass:NSDictionary.class]) {
    [self emitNativeError:@"schema_parse_error" message:error.localizedDescription ?: @"Invalid NativeHomeTabs schema"];
    return;
  }

  BOOL shouldPreserveActiveTab = _schema != nil;
  _schema = (NSDictionary *)json;
  [self applyCurrentSchemaPreservingActiveTab:shouldPreserveActiveTab];
}

- (void)applyCurrentSchemaPreservingActiveTab:(BOOL)preserveActiveTab
{
  NSString *nextActiveTabKey = [_schema[@"activeTabKey"] isKindOfClass:NSString.class]
    ? _schema[@"activeTabKey"]
    : @"portfolio";
  _tabs = [_schema[@"tabs"] isKindOfClass:NSArray.class] ? _schema[@"tabs"] : @[];
  if (!preserveActiveTab || ![self isEnabledTab:_activeTabKey]) {
    _activeTabKey = [self resolvedActiveTabKey:nextActiveTabKey];
  }
  [self rebuildTabBar];
  [self rebuildRows];
  [self syncRefreshingState];
  [self setNeedsLayout];
}

- (void)setActiveTabKey:(NSString *)tabKey source:(NSString *)source
{
  if (tabKey.length == 0 || [_activeTabKey isEqualToString:tabKey] || ![self isEnabledTab:tabKey]) {
    return;
  }
  _activeTabKey = tabKey;
  _lastEndReachedItemCount = -1;
  _lastVisibleRowsJson = @"";
  [self rebuildTabBar];
  [self rebuildRows];
  [self syncRefreshingState];
  [self scrollToTop:tabKey animated:NO];
  [self emitTabChange:tabKey source:source];
}

- (void)switchToAdjacentTab:(NSInteger)direction
{
  NSArray<NSDictionary *> *enabledTabs = [self enabledTabs];
  NSInteger currentIndex = NSNotFound;
  for (NSInteger index = 0; index < enabledTabs.count; index += 1) {
    NSString *key = [enabledTabs[index][@"key"] isKindOfClass:NSString.class] ? enabledTabs[index][@"key"] : @"";
    if ([key isEqualToString:_activeTabKey]) {
      currentIndex = index;
      break;
    }
  }
  if (currentIndex == NSNotFound) {
    return;
  }
  NSInteger nextIndex = currentIndex + direction;
  if (nextIndex >= 0 && nextIndex < enabledTabs.count) {
    NSString *key = enabledTabs[nextIndex][@"key"];
    [self setActiveTabKey:key source:@"swipe"];
  }
}

- (void)rebuildTabBar
{
  for (UIView *view in _tabBar.arrangedSubviews.copy) {
    [_tabBar removeArrangedSubview:view];
    [view removeFromSuperview];
  }

  for (NSDictionary *tab in [self enabledTabs]) {
    NSString *key = [tab[@"key"] isKindOfClass:NSString.class] ? tab[@"key"] : @"";
    NSString *title = [tab[@"title"] isKindOfClass:NSString.class] ? tab[@"title"] : key;
    BOOL selected = [key isEqualToString:_activeTabKey];
    UIButton *button = [UIButton buttonWithType:UIButtonTypeSystem];
    UIColor *foregroundColor = selected ? UIColor.whiteColor : UIColor.labelColor;
    UIFont *titleFont = [UIFont systemFontOfSize:16 weight:selected ? UIFontWeightSemibold : UIFontWeightRegular];
    UIButtonConfiguration *configuration = [UIButtonConfiguration plainButtonConfiguration];
    configuration.attributedTitle = [[NSAttributedString alloc] initWithString:title attributes:@{
      NSFontAttributeName: titleFont,
      NSForegroundColorAttributeName: foregroundColor,
    }];
    configuration.baseForegroundColor = foregroundColor;
    configuration.contentInsets = NSDirectionalEdgeInsetsMake(8, 14, 8, 14);
    configuration.background.backgroundColor = selected ? UIColor.labelColor : UIColor.clearColor;
    configuration.background.cornerRadius = 16;
    button.configuration = configuration;
    button.accessibilityIdentifier = [NSString stringWithFormat:@"native-home-tab-%@", key];
    button.tag = _tabBar.arrangedSubviews.count;
    [button addTarget:self action:@selector(handleTabButtonPress:) forControlEvents:UIControlEventTouchUpInside];
    [_tabBar addArrangedSubview:button];
  }

  if ([self shouldShowSettingsButton]) {
    UIView *spacer = [UIView new];
    [spacer setContentHuggingPriority:UILayoutPriorityDefaultLow forAxis:UILayoutConstraintAxisHorizontal];
    [_tabBar addArrangedSubview:spacer];

    UIButton *settingsButton = [UIButton buttonWithType:UIButtonTypeSystem];
    UIImage *image = [UIImage systemImageNamed:@"slider.horizontal.3"];
    if (image) {
      [settingsButton setImage:image forState:UIControlStateNormal];
    } else {
      [settingsButton setTitle:@"..." forState:UIControlStateNormal];
    }
    settingsButton.tintColor = UIColor.secondaryLabelColor;
    settingsButton.accessibilityIdentifier = @"native-home-tab-settings";
    [settingsButton.widthAnchor constraintEqualToConstant:44].active = YES;
    [settingsButton.heightAnchor constraintEqualToConstant:44].active = YES;
    [settingsButton addTarget:self action:@selector(handleSettingsButtonPress) forControlEvents:UIControlEventTouchUpInside];
    [_tabBar addArrangedSubview:settingsButton];
  }
}

- (void)handleTabButtonPress:(UIButton *)sender
{
  NSArray<NSDictionary *> *enabledTabs = [self enabledTabs];
  if (sender.tag >= 0 && sender.tag < enabledTabs.count) {
    NSString *key = enabledTabs[sender.tag][@"key"];
    [self setActiveTabKey:key source:@"tap"];
  }
}

- (void)handleSettingsButtonPress
{
  [self emitRowAction:@"tabBar:settings" rowType:@"tabBar" action:@"settings"];
}

- (void)rebuildRows
{
  NSDictionary *rowsByTab = [_schema[@"rowsByTab"] isKindOfClass:NSDictionary.class] ? _schema[@"rowsByTab"] : @{};
  NSArray *rows = [rowsByTab[_activeTabKey ?: @""] isKindOfClass:NSArray.class] ? rowsByTab[_activeTabKey] : @[];
  NSMutableArray<NSDictionary *> *validRows = [NSMutableArray array];
  for (NSDictionary *row in rows) {
    if ([row isKindOfClass:NSDictionary.class]) {
      [validRows addObject:row];
    }
  }
  _activeRows = validRows;
  [_collectionView reloadData];
}

- (void)attachReactChild:(UIView *)child
{
  NSString *nativeID = [self nativeIDForChild:child];
  if (nativeID.length == 0 || [nativeID isEqualToString:OKHomeHeaderNativeID]) {
    [self attachView:child toParent:_headerContainer];
    return;
  }
  if ([nativeID hasPrefix:OKHomeSlotNativeIDPrefix]) {
    NSString *slotID = [nativeID substringFromIndex:OKHomeSlotNativeIDPrefix.length];
    _slotViews[slotID] = child;
    [_collectionView reloadData];
    return;
  }
  [self attachView:child toParent:_headerContainer];
}

- (void)attachView:(UIView *)child toParent:(UIView *)parent
{
  [child removeFromSuperview];
  child.frame = parent.bounds;
  child.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [parent addSubview:child];
}

- (void)attachSlotForRow:(NSDictionary *)row toCell:(OKNativeHomeTabsRowCell *)cell
{
  NSString *slotID = [row[@"slotId"] isKindOfClass:NSString.class] ? row[@"slotId"] : nil;
  UIView *slotView = slotID.length > 0 ? _slotViews[slotID] : nil;
  if (!slotView) {
    return;
  }
  [slotView removeFromSuperview];
  slotView.frame = cell.contentView.bounds;
  slotView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [cell.contentView addSubview:slotView];
}

- (NSString *)nativeIDForChild:(UIView *)child
{
  if ([child isKindOfClass:RCTViewComponentView.class]) {
    return ((RCTViewComponentView *)child).nativeId;
  }
  if ([child respondsToSelector:@selector(nativeId)]) {
    return [child valueForKey:@"nativeId"];
  }
  return nil;
}

- (NSArray<NSDictionary *> *)enabledTabs
{
  NSMutableArray<NSDictionary *> *enabledTabs = [NSMutableArray array];
  for (NSDictionary *tab in _tabs) {
    if (![tab isKindOfClass:NSDictionary.class] || [tab[@"enabled"] isEqual:@NO]) {
      continue;
    }
    [enabledTabs addObject:tab];
  }
  return enabledTabs;
}

- (BOOL)isEnabledTab:(NSString *)tabKey
{
  for (NSDictionary *tab in [self enabledTabs]) {
    NSString *key = [tab[@"key"] isKindOfClass:NSString.class] ? tab[@"key"] : @"";
    if ([key isEqualToString:tabKey]) {
      return YES;
    }
  }
  return NO;
}

- (NSString *)resolvedActiveTabKey:(NSString *)requestedTabKey
{
  if ([self isEnabledTab:requestedTabKey]) {
    return requestedTabKey;
  }
  NSArray<NSDictionary *> *enabledTabs = [self enabledTabs];
  NSDictionary *firstTab = enabledTabs.firstObject;
  NSString *firstKey = [firstTab[@"key"] isKindOfClass:NSString.class] ? firstTab[@"key"] : nil;
  return firstKey.length > 0 ? firstKey : _activeTabKey;
}

- (BOOL)shouldShowSettingsButton
{
  NSDictionary *tabBar = [_schema[@"tabBar"] isKindOfClass:NSDictionary.class] ? _schema[@"tabBar"] : @{};
  return [tabBar[@"showSettingsButton"] boolValue];
}

- (CGFloat)currentHeaderHeight
{
  CGFloat measuredHeight = [_headerContainer systemLayoutSizeFittingSize:CGSizeMake(self.bounds.size.width, UIViewNoIntrinsicMetric)].height;
  return MAX(MAX(measuredHeight, _headerContainer.bounds.size.height), _initialHeaderHeight);
}

- (CGFloat)tabBarHeight
{
  CGSize size = [_tabBar sizeThatFits:CGSizeMake(self.bounds.size.width, CGFLOAT_MAX)];
  return MAX(size.height, 48);
}

- (CGFloat)estimatedHeightForRow:(NSDictionary *)row
{
  NSNumber *height = [row[@"estimatedHeight"] isKindOfClass:NSNumber.class] ? row[@"estimatedHeight"] : nil;
  if (height.doubleValue > 0) {
    return height.doubleValue;
  }
  NSString *type = [row[@"type"] isKindOfClass:NSString.class] ? row[@"type"] : @"text";
  if ([type isEqualToString:@"sectionHeader"]) {
    return 56;
  }
  if ([type isEqualToString:@"token"] || [type isEqualToString:@"defi"] || [type isEqualToString:@"history"]) {
    return 72;
  }
  if ([type isEqualToString:@"rnSlot"]) {
    return 96;
  }
  if ([type isEqualToString:@"empty"]) {
    return 96;
  }
  return 64;
}

- (void)syncCollectionInsets
{
  CGFloat topInset = _topInset + [self currentHeaderHeight] + [self tabBarHeight];
  CGFloat oldTopInset = _collectionView.contentInset.top;
  BOOL wasAtTop = oldTopInset == 0 || _collectionView.contentOffset.y <= -oldTopInset + 1;
  UIEdgeInsets contentInset = UIEdgeInsetsMake(topInset, 0, _bottomInset, 0);
  if (!UIEdgeInsetsEqualToEdgeInsets(_collectionView.contentInset, contentInset)) {
    _collectionView.contentInset = contentInset;
    _collectionView.scrollIndicatorInsets = contentInset;
    if (wasAtTop) {
      _collectionView.contentOffset = CGPointMake(0, -topInset);
    }
  }
}

- (void)updateOverlayFrames
{
  CGFloat width = _rootView.bounds.size.width;
  CGFloat headerHeight = [self currentHeaderHeight];
  CGFloat tabHeight = [self tabBarHeight];
  CGFloat scrollOffset = MAX(_collectionView.contentOffset.y + _collectionView.contentInset.top, 0);
  CGFloat collapseY = MIN(scrollOffset, headerHeight);

  _headerContainer.frame = CGRectMake(0, _topInset - collapseY, width, headerHeight);
  _tabBar.frame = CGRectMake(0, _topInset + headerHeight - collapseY, width, tabHeight);

  for (UIView *child in _headerContainer.subviews) {
    child.frame = _headerContainer.bounds;
  }
}

- (void)syncRefreshingState
{
  NSDictionary *refreshingByTab = [_schema[@"refreshingByTab"] isKindOfClass:NSDictionary.class] ? _schema[@"refreshingByTab"] : @{};
  BOOL refreshing = [refreshingByTab[_activeTabKey] boolValue];
  if (!refreshing && _refreshControl.refreshing) {
    [_refreshControl endRefreshing];
  } else if (refreshing && !_refreshControl.refreshing) {
    [_refreshControl beginRefreshing];
  }
}

- (void)syncSwipeEnabled
{
  _swipeLeftGesture.enabled = _enableHorizontalSwipe;
  _swipeRightGesture.enabled = _enableHorizontalSwipe;
}

- (void)maybeEmitEndReached
{
  NSInteger itemCount = _activeRows.count;
  if (itemCount == 0 || itemCount == _lastEndReachedItemCount) {
    return;
  }
  CGFloat visibleBottom = _collectionView.contentOffset.y + _collectionView.bounds.size.height;
  CGFloat triggerY = _collectionView.contentSize.height + _collectionView.contentInset.bottom - 120;
  if (visibleBottom >= triggerY) {
    _lastEndReachedItemCount = itemCount;
    [self emitEndReached:itemCount];
  }
}

- (void)maybeEmitVisibleRows
{
  NSArray<NSIndexPath *> *indexPaths = [_collectionView.indexPathsForVisibleItems sortedArrayUsingSelector:@selector(compare:)];
  NSMutableArray<NSString *> *keys = [NSMutableArray array];
  for (NSIndexPath *indexPath in indexPaths) {
    if (indexPath.item >= 0 && indexPath.item < _activeRows.count) {
      NSString *key = [_activeRows[indexPath.item][@"key"] isKindOfClass:NSString.class] ? _activeRows[indexPath.item][@"key"] : @"";
      if (key.length > 0) {
        [keys addObject:key];
      }
    }
  }
  NSData *data = [NSJSONSerialization dataWithJSONObject:keys options:0 error:nil];
  NSString *json = data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : @"[]";
  if (![json isEqualToString:_lastVisibleRowsJson]) {
    _lastVisibleRowsJson = json;
    [self emitVisibleRows:json];
  }
}

- (NSDictionary *)dictionaryByMergingBase:(NSDictionary *)base patch:(NSDictionary *)patch
{
  NSMutableDictionary *result = [base mutableCopy];
  [patch enumerateKeysAndObjectsUsingBlock:^(id key, id patchValue, BOOL *stop) {
    id baseValue = result[key];
    if ([baseValue isKindOfClass:NSDictionary.class] && [patchValue isKindOfClass:NSDictionary.class]) {
      result[key] = [self dictionaryByMergingBase:baseValue patch:patchValue];
    } else {
      result[key] = patchValue;
    }
  }];
  return result;
}

- (void)emitTabChange:(NSString *)tabKey source:(NSString *)source
{
  auto emitter = std::dynamic_pointer_cast<const OKNativeHomeTabsEventEmitter>(_eventEmitter);
  if (!emitter) {
    return;
  }
  OKNativeHomeTabsEventEmitter::OnTabChange event = {
    .tabKey = OKStdStringFromNSString(tabKey),
    .source = OKTabChangeSourceFromNSString(source),
  };
  emitter->onTabChange(event);
}

- (void)emitRefresh
{
  auto emitter = std::dynamic_pointer_cast<const OKNativeHomeTabsEventEmitter>(_eventEmitter);
  if (!emitter) {
    return;
  }
  OKNativeHomeTabsEventEmitter::OnRefresh event = {
    .tabKey = OKStdStringFromNSString(_activeTabKey),
  };
  emitter->onRefresh(event);
}

- (void)emitEndReached:(NSInteger)itemCount
{
  auto emitter = std::dynamic_pointer_cast<const OKNativeHomeTabsEventEmitter>(_eventEmitter);
  if (!emitter) {
    return;
  }
  OKNativeHomeTabsEventEmitter::OnEndReached event = {
    .tabKey = OKStdStringFromNSString(_activeTabKey),
    .itemCount = static_cast<double>(itemCount),
  };
  emitter->onEndReached(event);
}

- (void)emitRowPress:(NSString *)rowKey rowType:(NSString *)rowType
{
  auto emitter = std::dynamic_pointer_cast<const OKNativeHomeTabsEventEmitter>(_eventEmitter);
  if (!emitter) {
    return;
  }
  OKNativeHomeTabsEventEmitter::OnRowPress event = {
    .tabKey = OKStdStringFromNSString(_activeTabKey),
    .rowKey = OKStdStringFromNSString(rowKey),
    .rowType = OKStdStringFromNSString(rowType),
  };
  emitter->onRowPress(event);
}

- (void)emitRowAction:(NSString *)rowKey rowType:(NSString *)rowType action:(NSString *)action
{
  (void)action;
  auto emitter = std::dynamic_pointer_cast<const OKNativeHomeTabsEventEmitter>(_eventEmitter);
  if (!emitter) {
    return;
  }
  OKNativeHomeTabsEventEmitter::OnRowAction event = {
    .tabKey = OKStdStringFromNSString(_activeTabKey),
    .rowKey = OKStdStringFromNSString(rowKey),
    .rowType = OKStdStringFromNSString(rowType),
  };
  emitter->onRowAction(event);
}

- (void)emitVisibleRows:(NSString *)rowKeysJson
{
  auto emitter = std::dynamic_pointer_cast<const OKNativeHomeTabsEventEmitter>(_eventEmitter);
  if (!emitter) {
    return;
  }
  OKNativeHomeTabsEventEmitter::OnVisibleRowsChange event = {
    .tabKey = OKStdStringFromNSString(_activeTabKey),
    .rowKeysJson = OKStdStringFromNSString(rowKeysJson),
  };
  emitter->onVisibleRowsChange(event);
}

- (void)emitNativeError:(NSString *)code message:(NSString *)message
{
  auto emitter = std::dynamic_pointer_cast<const OKNativeHomeTabsEventEmitter>(_eventEmitter);
  if (!emitter) {
    return;
  }
  OKNativeHomeTabsEventEmitter::OnNativeError event = {
    .code = OKStdStringFromNSString(code),
    .message = OKStdStringFromNSString(message),
  };
  emitter->onNativeError(event);
}

@end

Class<RCTComponentViewProtocol> OKNativeHomeTabsCls(void)
{
  return OKNativeHomeTabsComponentView.class;
}

#endif
