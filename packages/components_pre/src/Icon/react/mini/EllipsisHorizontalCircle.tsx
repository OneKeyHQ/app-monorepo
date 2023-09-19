import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEllipsisHorizontalCircle = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0zm8 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm7 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEllipsisHorizontalCircle;
