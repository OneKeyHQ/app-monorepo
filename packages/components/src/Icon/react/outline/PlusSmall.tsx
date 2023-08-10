import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPlusSmall = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
  </Svg>
);
export default SvgPlusSmall;
