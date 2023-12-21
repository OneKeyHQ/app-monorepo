import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNumberedList = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 17h8M12 7h8M6 9.5v-5l-2 1m.25 9.5s.65-.5 1.361-.5A1.39 1.39 0 0 1 7 15.889C7 17.689 4 18 4 19.5h3.25"
    />
  </Svg>
);
export default SvgNumberedList;
