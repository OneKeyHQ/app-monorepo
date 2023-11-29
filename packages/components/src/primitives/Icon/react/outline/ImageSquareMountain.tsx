import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgImageSquareMountain = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="m16 20-6.586-6.586a2 2 0 0 0-2.828 0L4 16m2 4h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2ZM16.5 9.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
    />
  </Svg>
);
export default SvgImageSquareMountain;
