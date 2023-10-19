import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRemovePeople = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 20H6.697c-1.179 0-2.123-1.032-1.714-2.137C6.036 15.014 8.609 13 12 13c.342 0 .676.02 1 .06M20 16l-2 2m0 0-2 2m2-2-2-2m2 2 2 2M15.5 6.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
    />
  </Svg>
);
export default SvgRemovePeople;
