import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBluetooth = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.167}
      d="m12.302 12 4.665-3.732a.77.77 0 0 0 0-1.202L12.2 3.25a.77.77 0 0 0-1.251.602v7.065M12.302 12l-1.354 1.083M12.302 12l4.665 3.732a.77.77 0 0 1 0 1.202L12.2 20.75a.77.77 0 0 1-1.251-.602v-7.065M12.302 12l-1.354-1.083m0 2.166L5.53 17.417m5.417-4.334v-2.166m0 0L5.53 6.583"
    />
  </Svg>
);
export default SvgBluetooth;
