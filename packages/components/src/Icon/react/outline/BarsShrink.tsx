import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBarsShrink = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3.75 6a.75.75 0 0 0 0 1.5V6Zm16.5 1.5a.75.75 0 0 0 0-1.5v1.5Zm-14.5 3.75a.75.75 0 0 0 0 1.5v-1.5Zm12.5 1.5a.75.75 0 0 0 0-1.5v1.5ZM7.75 16.5a.75.75 0 0 0 0 1.5v-1.5Zm8.5 1.5a.75.75 0 0 0 0-1.5V18ZM3.75 7.5h16.5V6H3.75v1.5Zm2 5.25h12.5v-1.5H5.75v1.5Zm2 5.25h8.5v-1.5h-8.5V18Z" />
  </Svg>
);
export default SvgBarsShrink;
