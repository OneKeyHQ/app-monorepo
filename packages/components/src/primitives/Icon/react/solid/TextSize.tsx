import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTextSize = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M10 4a1 1 0 1 0 0 2h5v14a1 1 0 1 0 2 0V6h5a1 1 0 1 0 0-2H10Z"
    />
    <Path
      fill="currentColor"
      d="M5.927 20v-8H2a1 1 0 1 1 0-2h4.882a1.015 1.015 0 0 1 .09 0H12a1 1 0 1 1 0 2H7.927v8a1 1 0 1 1-2 0Z"
    />
  </Svg>
);
export default SvgTextSize;
