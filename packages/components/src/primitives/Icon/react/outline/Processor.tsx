import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgProcessor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4.997v-2M16 5V3M8 5V2.996M12 21v-2m4 2v-2m-8 2v-2m11-3h2m-2-8h2m-2 4h2M3 12h2m-2 4h2M3 8h2m10.001 4A3.001 3.001 0 1 1 9 12a3.001 3.001 0 0 1 6 0ZM7 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgProcessor;
