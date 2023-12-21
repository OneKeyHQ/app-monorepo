import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFrozen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M11.998 3v18M4.204 7.5l15.588 9m-15.589 0 15.589-9"
    />
  </Svg>
);
export default SvgFrozen;
