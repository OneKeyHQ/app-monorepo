import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBezierCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M18.71 10H18a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h.71m0-4H20a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1.29m0-4A7.015 7.015 0 0 0 14 5.29M18.71 14A7.015 7.015 0 0 1 14 18.71m0 0V18a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v.71m4 0V20a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1.29m0 0A7.015 7.015 0 0 1 5.29 14m0 0H6a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-.71m0 4H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h1.29m0 0A7.015 7.015 0 0 1 10 5.29m0 0V6a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-.71m-4 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.29"
    />
  </Svg>
);
export default SvgBezierCircle;
