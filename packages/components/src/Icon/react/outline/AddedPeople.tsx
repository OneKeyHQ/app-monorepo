import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAddedPeople = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m15 18.5 2 1.5 3-5m-5-1.412A7.688 7.688 0 0 0 12 13c-3.391 0-5.964 2.014-7.017 4.863C4.573 18.968 5.518 20 6.697 20H11m4.5-13.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
    />
  </Svg>
);
export default SvgAddedPeople;
