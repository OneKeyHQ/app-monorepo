import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLogout = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11.25 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.25M20 12H8.75M20 12l-4.5 4.5M20 12l-4.5-4.5"
    />
  </Svg>
);
export default SvgLogout;
