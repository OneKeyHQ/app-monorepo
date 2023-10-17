import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgColumnWide = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M11 4H5a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h6V4Zm2 16h6a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3h-6v16Z"
    />
  </Svg>
);
export default SvgColumnWide;
