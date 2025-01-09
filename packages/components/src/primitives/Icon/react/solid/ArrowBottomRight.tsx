import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowBottomRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M18 8a1 1 0 0 1 1 1v7a3 3 0 0 1-3 3H9a1 1 0 1 1 0-2h6.586L5.793 7.207a1 1 0 0 1 1.414-1.414L17 15.586V9a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowBottomRight;
