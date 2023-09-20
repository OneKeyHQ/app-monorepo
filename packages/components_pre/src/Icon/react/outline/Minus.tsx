import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMinus = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
  </Svg>
);
export default SvgMinus;
