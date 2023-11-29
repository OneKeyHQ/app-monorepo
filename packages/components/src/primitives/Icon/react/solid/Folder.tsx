import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolder = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 3a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-6.465l-1.11-1.664A3 3 0 0 0 8.93 3H5Z"
    />
  </Svg>
);
export default SvgFolder;
