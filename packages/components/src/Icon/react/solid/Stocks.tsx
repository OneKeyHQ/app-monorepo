import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgStocks = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M15 3h3a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-3v-8.17a3.001 3.001 0 0 0 0-5.66V3Zm-2 18v-8.171a2.959 2.959 0 0 1-.293-.122l-3 3a1 1 0 0 1-1.414 0L7 14.414 3.025 18.39A3 3 0 0 0 6 21h7ZM3 15.586V6a3 3 0 0 1 3-3h7v4.17a3.001 3.001 0 0 0-1.707 4.123L9 13.586l-1.293-1.293a1 1 0 0 0-1.414 0L3 15.586ZM13 10a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z"
    />
  </Svg>
);
export default SvgStocks;
