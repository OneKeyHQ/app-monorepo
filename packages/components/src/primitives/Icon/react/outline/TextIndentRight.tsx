import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTextIndentRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M15 18a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h11a1 1 0 0 1 1 1Zm0-6a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h11a1 1 0 0 1 1 1Zm0-6a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h11a1 1 0 0 1 1 1Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M22 9.78v4.44c0 .836-.914 1.322-1.572.837l-3.01-2.22a1.049 1.049 0 0 1 0-1.674l3.01-2.22c.658-.486 1.572.001 1.572.837Z"
    />
  </Svg>
);
export default SvgTextIndentRight;
