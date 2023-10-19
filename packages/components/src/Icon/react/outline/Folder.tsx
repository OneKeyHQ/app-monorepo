import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolder = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 6v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6.465a1 1 0 0 1-.832-.445l-1.11-1.664A2 2 0 0 0 8.93 4H5a2 2 0 0 0-2 2Z"
    />
  </Svg>
);
export default SvgFolder;
