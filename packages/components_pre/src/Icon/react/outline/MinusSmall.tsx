import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMinusSmall = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
  </Svg>
);
export default SvgMinusSmall;
