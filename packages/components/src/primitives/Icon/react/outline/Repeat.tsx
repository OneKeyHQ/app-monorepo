import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRepeat = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m17.25 3 2.47 2.47a.75.75 0 0 1 0 1.06L17.25 9M6.75 21l-2.47-2.47a.75.75 0 0 1 0-1.06L6.75 15M5 18h13a2 2 0 0 0 2-2v-3M4 11V8a2 2 0 0 1 2-2h13"
    />
  </Svg>
);
export default SvgRepeat;
