import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUndo = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6.5 5 3.207 8.293a1 1 0 0 0 0 1.414L6.5 13M4 9h13a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4h-5"
    />
  </Svg>
);
export default SvgUndo;
