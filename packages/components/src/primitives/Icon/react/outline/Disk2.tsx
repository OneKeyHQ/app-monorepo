import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDisk2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M9 4v3a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4m5 3.828V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10.172a2 2 0 0 1 1.414.586l1.828 1.828A2 2 0 0 1 20 7.828ZM15 14a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </Svg>
);
export default SvgDisk2;
