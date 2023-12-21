import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPeople = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.5 6.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM12 13c-3.391 0-5.964 2.014-7.017 4.863C4.573 18.968 5.518 20 6.697 20h10.606c1.179 0 2.123-1.032 1.715-2.137C17.964 15.014 15.39 13 12 13Z"
    />
  </Svg>
);
export default SvgPeople;
