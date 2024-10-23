import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShortcuts = (props: SvgProps) => (
  <Svg viewBox="0 0 24 25" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="m10 16.32 4-8m-8-4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Z"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SvgShortcuts;
