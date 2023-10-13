import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSliderThree = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5.951 20.004v-6.003m0-4.001V3.997m6.05 16.007V13m0-4V3.996m6.048 16.007v-4.002m0-4.001V3.997M3.996 14.002h3.91m2.139-5.003h3.91m2.138 7.003h3.91"
    />
  </Svg>
);
export default SvgSliderThree;
