import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDotVer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10 4a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm0 8a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm0 8a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDotVer;
