/* eslint-disable */

import { ReactNode, Component } from 'react';
import {
  FlatList,
  FlatListProps,
  GestureResponderEvent,
  I18nManager,
  LayoutChangeEvent,
  ListRenderItemInfo,
  NativeScrollEvent,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import mergeExtraData from './merge-extradata';

const isAndroidRTL = I18nManager.isRTL && Platform.OS === 'android';

type Props<ItemT> = {
  data: ItemT[];
  renderItem: (
    info: ListRenderItemInfo<ItemT> & {
      dimensions: { width: number; height: number };
    },
  ) => ReactNode;
  renderSkipButton?: () => ReactNode;
  renderNextButton?: () => ReactNode;
  renderDoneButton?: () => ReactNode;
  renderPrevButton?: () => ReactNode;
  onSlideChange?: (a: number, b: number) => void;
  onSkip?: () => void;
  onDone?: () => void;
  renderPagination?: (activeIndex: number) => ReactNode;
  activeDotStyle: ViewStyle;
  dotStyle: ViewStyle;
  dotClickEnabled: boolean;
  skipLabel: string;
  doneLabel: string;
  nextLabel: string;
  prevLabel: string;
  showDoneButton: boolean;
  showNextButton: boolean;
  showPrevButton: boolean;
  showSkipButton: boolean;
  bottomButton: boolean;
} & FlatListProps<ItemT>;

type State = {
  width: number;
  height: number;
  activeIndex: number;
};

export default class AppIntroSlider<ItemT = any> extends Component<
  Props<ItemT>,
  State
> {
  static defaultProps = {
    activeDotStyle: {
      backgroundColor: 'rgba(255, 255, 255, .9)',
    },
    dotStyle: {
      backgroundColor: 'rgba(0, 0, 0, .2)',
    },
    dotClickEnabled: true,
    skipLabel: 'Skip',
    doneLabel: 'Done',
    nextLabel: 'Next',
    prevLabel: 'Back',
    showDoneButton: true,
    showNextButton: true,
    showPrevButton: false,
    showSkipButton: false,
    bottomButton: false,
  };

  override state = {
    width: 0,
    height: 0,
    activeIndex: 0,
  };

  flatList: FlatList<ItemT> | undefined;

  goToSlide = (pageNum: number, triggerOnSlideChange?: boolean) => {
    const prevNum = this.state.activeIndex;
    this.setState({ activeIndex: pageNum });
    this.flatList?.scrollToOffset({
      offset: this._rtlSafeIndex(pageNum) * this.state.width,
    });
    if (triggerOnSlideChange && this.props.onSlideChange) {
      this.props.onSlideChange(pageNum, prevNum);
    }
  };

  // Get the list ref
  getListRef = () => this.flatList;

  // Index that works across Android's weird rtl bugs
  _rtlSafeIndex = (i: number) =>
    isAndroidRTL ? this.props.data.length - 1 - i : i;

  // Render a slide
  _renderItem = (flatListArgs: any) => {
    const { width, height } = this.state;
    const props = { ...flatListArgs, dimensions: { width, height } };
    // eslint-disable-next-line react-native/no-inline-styles
    return (
      <View style={{ width, flex: 1 }}>{this.props.renderItem(props)}</View>
    );
  };

  _renderButton = (
    name: string,
    label: string,
    onPress?: () => void,
    render?: () => ReactNode,
  ) => {
    const content = render ? render() : this._renderDefaultButton(name, label);
    return this._renderOuterButton(content, name, onPress);
  };

  _renderDefaultButton = (name: string, label: string) => {
    let content = <Text style={styles.buttonText}>{label}</Text>;
    if (this.props.bottomButton) {
      content = (
        <View
          style={[
            name === 'Skip' || name === 'Prev'
              ? styles.transparentBottomButton
              : styles.bottomButton,
          ]}
        >
          {content}
        </View>
      );
    }
    return content;
  };

  _renderOuterButton = (
    content: ReactNode,
    name: string,
    onPress?: (e: GestureResponderEvent) => void,
  ) => {
    const style =
      name === 'Skip' || name === 'Prev'
        ? styles.leftButtonContainer
        : styles.rightButtonContainer;
    return (
      <View style={!this.props.bottomButton && style}>
        <TouchableOpacity
          onPress={onPress}
          style={this.props.bottomButton && styles.flexOne}
        >
          {content}
        </TouchableOpacity>
      </View>
    );
  };

  _renderNextButton = () =>
    this.props.showNextButton &&
    this._renderButton(
      'Next',
      this.props.nextLabel,
      () => this.goToSlide(this.state.activeIndex + 1, true),
      this.props.renderNextButton,
    );

  _renderPrevButton = () =>
    this.props.showPrevButton &&
    this._renderButton(
      'Prev',
      this.props.prevLabel,
      () => this.goToSlide(this.state.activeIndex - 1, true),
      this.props.renderPrevButton,
    );

  _renderDoneButton = () =>
    this.props.showDoneButton &&
    this._renderButton(
      'Done',
      this.props.doneLabel,
      this.props.onDone,
      this.props.renderDoneButton,
    );

  _renderSkipButton = () =>
    // scrollToEnd does not work in RTL so use goToSlide instead
    this.props.showSkipButton &&
    this._renderButton(
      'Skip',
      this.props.skipLabel,
      () =>
        this.props.onSkip
          ? this.props.onSkip()
          : this.goToSlide(this.props.data.length - 1),
      this.props.renderSkipButton,
    );

  _renderPagination = () => {
    const isLastSlide = this.state.activeIndex === this.props.data.length - 1;
    const isFirstSlide = this.state.activeIndex === 0;

    const secondaryButton =
      (!isFirstSlide && this._renderPrevButton()) ||
      (!isLastSlide && this._renderSkipButton());
    const primaryButton = isLastSlide
      ? this._renderDoneButton()
      : this._renderNextButton();

    return (
      <View style={styles.paginationContainer}>
        <SafeAreaView>
          <View style={styles.paginationDots}>
            {this.props.data.length > 1 &&
              this.props.data.map((_, i) =>
                this.props.dotClickEnabled ? (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.dot,
                      this._rtlSafeIndex(i) === this.state.activeIndex
                        ? this.props.activeDotStyle
                        : this.props.dotStyle,
                    ]}
                    onPress={() => this.goToSlide(i, true)}
                  />
                ) : (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      this._rtlSafeIndex(i) === this.state.activeIndex
                        ? this.props.activeDotStyle
                        : this.props.dotStyle,
                    ]}
                  />
                ),
              )}
          </View>
          {primaryButton}
          {secondaryButton}
        </SafeAreaView>
      </View>
    );
  };

  _onMomentumScrollEnd = (e: { nativeEvent: NativeScrollEvent }) => {
    const offset = e.nativeEvent.contentOffset.x;
    // Touching very very quickly and continuous brings about
    // a variation close to - but not quite - the width.
    // That's why we round the number.
    // Also, Android phones and their weird numbers
    const newIndex = this._rtlSafeIndex(Math.round(offset / this.state.width));
    if (newIndex === this.state.activeIndex) {
      // No page change, don't do anything
      return;
    }
    const lastIndex = this.state.activeIndex;
    this.setState({ activeIndex: newIndex });
    this.props.onSlideChange && this.props.onSlideChange(newIndex, lastIndex);
  };

  _onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    if (width !== this.state.width || height !== this.state.height) {
      // Set new width to update rendering of pages
      this.setState({ width, height });
      // Set new scroll position
      const func = () => {
        this.flatList?.scrollToOffset({
          offset: this._rtlSafeIndex(this.state.activeIndex) * width,
          animated: false,
        });
      };
      setTimeout(func, 0); // Must be called like this to avoid bugs :/
    }
  };

  override render() {
    // Separate props used by the component to props passed to FlatList
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const {
      renderPagination,
      activeDotStyle,
      dotStyle,
      skipLabel,
      doneLabel,
      nextLabel,
      prevLabel,
      renderItem,
      data,
      extraData,
      ...otherProps
    } = this.props;
    /* eslint-enable @typescript-eslint/no-unused-vars */

    // Merge component width and user-defined extraData
    const extra = mergeExtraData(extraData, this.state.width);

    return (
      <View style={styles.flexOne}>
        <FlatList
          ref={(ref) => (this.flatList = ref as FlatList<ItemT>)}
          data={this.props.data}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          style={styles.flatList}
          renderItem={this._renderItem}
          onMomentumScrollEnd={this._onMomentumScrollEnd}
          extraData={extra}
          onLayout={this._onLayout}
          // make sure all slides are rendered so we can use dots to navigate to them
          initialNumToRender={data.length}
          {...otherProps}
        />
        {renderPagination
          ? renderPagination(this.state.activeIndex)
          : this._renderPagination()}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  flatList: {
    flex: 1,
    flexDirection: isAndroidRTL ? 'row-reverse' : 'row',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    justifyContent: 'center',
  },
  paginationDots: {
    height: 16,
    margin: 16,
    flexDirection: isAndroidRTL ? 'row-reverse' : 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 4,
  },
  leftButtonContainer: {
    position: 'absolute',
    left: 0,
  },
  rightButtonContainer: {
    position: 'absolute',
    right: 0,
  },
  bottomButton: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, .3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transparentBottomButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    padding: 12,
  },
});
