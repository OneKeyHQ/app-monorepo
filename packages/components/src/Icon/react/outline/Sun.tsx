import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSun = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 3V2m0 20v-1m6.36-15.36.71-.71M4.93 19.07l.71-.71M21 12h1M2 12h1m15.36 6.36.71.71M4.93 4.93l.71.71m9.896 2.824a5 5 0 1 1-7.071 7.072 5 5 0 0 1 7.07-7.072Z"
    />
  </Svg>
);
export default SvgSun;
