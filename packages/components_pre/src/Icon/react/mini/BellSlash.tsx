import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBellSlash = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 8c0-.26.017-.517.049-.77l7.722 7.723a33.56 33.56 0 0 1-3.722-.01 2 2 0 0 0 3.862.15l1.134 1.134a3.5 3.5 0 0 1-6.53-1.409 32.91 32.91 0 0 1-3.257-.508.75.75 0 0 1-.515-1.076A11.448 11.448 0 0 0 4 8zm13.266 5.9a.756.756 0 0 1-.068.116L6.389 3.207A6 6 0 0 1 16 8a11.466 11.466 0 0 0 1.258 5.234.75.75 0 0 1 .01.666zM3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06L3.28 2.22z" />
  </Svg>
);
export default SvgBellSlash;
