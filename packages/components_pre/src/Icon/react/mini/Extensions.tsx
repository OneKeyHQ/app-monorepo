import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgExtensions = (props: SvgProps) => (
  <Svg
    viewBox="0 0 16 16"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.667 7.335h-1V4.668c0-.733-.6-1.333-1.333-1.333H8.667v-1a1.667 1.667 0 0 0-3.333 0v1H2.667c-.733 0-1.326.6-1.326 1.333v2.533h.993a1.801 1.801 0 0 1 0 3.6h-1v2.534c0 .733.6 1.333 1.333 1.333h2.534v-1a1.801 1.801 0 0 1 3.6 0v1h2.533c.733 0 1.333-.6 1.333-1.333v-2.667h1a1.667 1.667 0 0 0 0-3.333Z" />
  </Svg>
);
export default SvgExtensions;
