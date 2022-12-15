import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSaveAs = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.707 7.293a1 1 0 0 0-1.414 1.414l3 3a1 1 0 0 0 1.414 0l3-3a1 1 0 0 0-1.414-1.414L13 8.586V5h3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3v3.586L9.707 7.293zM11 3a1 1 0 1 1 2 0v2h-2V3z" />
    <Path d="M4 9a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2H4V9z" />
  </Svg>
);
export default SvgSaveAs;
