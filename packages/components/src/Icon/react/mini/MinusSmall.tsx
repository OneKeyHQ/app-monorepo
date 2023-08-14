import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMinusSmall = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.75 9.25a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5z" />
  </Svg>
);
export default SvgMinusSmall;
