import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDotVer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
    />
  </Svg>
);
export default SvgDotVer;
