import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowBottomLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.5 6.5 6.75 17.25M6 9v7a2 2 0 0 0 2 2h7"
    />
  </Svg>
);
export default SvgArrowBottomLeft;
