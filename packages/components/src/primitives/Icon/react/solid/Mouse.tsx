import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMouse = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 9a7 7 0 0 1 14 0v6a7 7 0 1 1-14 0V9Zm8-2a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0V7Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMouse;
