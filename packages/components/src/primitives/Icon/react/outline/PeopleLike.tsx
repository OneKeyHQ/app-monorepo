import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPeopleLike = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 13.06a8.232 8.232 0 0 0-1-.06c-3.391 0-5.964 2.014-7.017 4.863C4.573 18.968 5.518 20 6.697 20H11.5m6.5 1.083c.25 0 3-1.416 3-3.333 0-1.333-.833-2-1.666-2-.834 0-1.334.5-1.334.5s-.5-.5-1.333-.5c-.834 0-1.667.667-1.667 2 0 1.917 2.75 3.333 3 3.333ZM15.5 6.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
    />
  </Svg>
);
export default SvgPeopleLike;
