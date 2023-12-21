import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowBottomLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M16 18a1 1 0 0 1-1 1H8a3 3 0 0 1-3-3V9a1 1 0 1 1 2 0v6.586l9.793-9.793a1 1 0 1 1 1.414 1.414L8.414 17H15a1 1 0 0 1 1 1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowBottomLeft;
