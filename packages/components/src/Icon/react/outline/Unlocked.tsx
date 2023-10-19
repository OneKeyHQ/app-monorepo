import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUnlocked = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 14v3m-4-7V7a4 4 0 0 1 7.874-1M7 21h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgUnlocked;
