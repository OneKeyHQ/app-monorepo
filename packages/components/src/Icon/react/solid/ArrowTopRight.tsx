import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowTopRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8 6a1 1 0 0 1 1-1h7a3 3 0 0 1 3 3v7a1 1 0 1 1-2 0V8.414l-9.793 9.793a1 1 0 0 1-1.414-1.414L15.586 7H9a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowTopRight;
