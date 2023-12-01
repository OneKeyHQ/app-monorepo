import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAddPeople = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 13.25a7.93 7.93 0 0 0-2-.25c-3.391 0-5.964 2.014-7.017 4.863C4.573 18.968 5.518 20 6.697 20H11m7-5v3m0 0v3m0-3h-3m3 0h3M15.5 6.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
    />
  </Svg>
);
export default SvgAddPeople;
