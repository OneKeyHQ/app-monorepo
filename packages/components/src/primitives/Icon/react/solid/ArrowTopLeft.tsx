import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowTopLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 16a1 1 0 0 1-1-1V8a3 3 0 0 1 3-3h7a1 1 0 1 1 0 2H8.414l9.793 9.793a1 1 0 0 1-1.414 1.414L7 8.414V15a1 1 0 0 1-1 1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowTopLeft;
