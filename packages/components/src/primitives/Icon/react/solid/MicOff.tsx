import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMicOff = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M17 11c0 .53-.083 1.042-.236 1.522L8.106 3.863A5 5 0 0 1 17 7v4ZM2.293 2.293a1 1 0 0 1 1.414 0l18 18a1 1 0 0 1-1.414 1.414l-3.25-3.249A8.628 8.628 0 0 1 13 19.948V21a1 1 0 1 1-2 0v-1.051c-3.554-.37-5.7-2.673-6.824-4.405a1 1 0 0 1 1.677-1.088C6.893 16.058 8.8 18 12 18c1.464 0 2.646-.403 3.599-.987l-1.482-1.482A5 5 0 0 1 7 11V8.413L2.293 3.707a1 1 0 0 1 0-1.414Z"
    />
  </Svg>
);
export default SvgMicOff;
