import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPencil = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m13.5 6 2.086-2.086a2 2 0 0 1 2.828 0l1.672 1.672a2 2 0 0 1 0 2.828L18 10.5M13.5 6 3.293 16.207a1 1 0 0 0-.293.707V21h4.086a1 1 0 0 0 .707-.293L18 10.5M13.5 6l4.5 4.5"
    />
  </Svg>
);
export default SvgPencil;
