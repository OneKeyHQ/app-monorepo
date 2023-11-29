import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLookGlasses = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6 7a4.99 4.99 0 0 0-4 2H1a1 1 0 0 0 0 2h.1a5 5 0 1 0 9.601-.705A2.987 2.987 0 0 1 12 10c.466 0 .906.106 1.299.295A5 5 0 1 0 22.9 11h.1a1 1 0 1 0 0-2h-1a4.993 4.993 0 0 0-4-2c-1.442 0-2.74.61-3.652 1.585A4.98 4.98 0 0 0 12 8a4.98 4.98 0 0 0-2.348.585A4.987 4.987 0 0 0 6 7Z"
    />
  </Svg>
);
export default SvgLookGlasses;
