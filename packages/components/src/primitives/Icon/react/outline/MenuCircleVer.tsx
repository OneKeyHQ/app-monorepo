import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMenuCircleVer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.75}
      d="M11.125 8a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm0 4a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm0 4a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z"
    />
  </Svg>
);
export default SvgMenuCircleVer;
