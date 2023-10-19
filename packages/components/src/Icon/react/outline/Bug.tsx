import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBug = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 13v2a6 6 0 0 0 12 0v-2M6 13H3m3 0v-3c0-.365.098-.706.268-1M18 13h3m-3 0v-3c0-.39-.111-.753-.304-1.06M6 17l-2.75 1M18 17l2.75 1M12 13v7M8 7.5V7a4 4 0 1 1 8 0v.5M6.27 9h-.002m0 0L3.25 8m3.018 1A2 2 0 0 1 8 8h8c.715 0 1.343.375 1.696.94m0 0L20.75 8"
    />
  </Svg>
);
export default SvgBug;
