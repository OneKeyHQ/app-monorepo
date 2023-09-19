import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgColorSwatch = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4 2a2 2 0 0 0-2 2v11a3 3 0 1 0 6 0V4a2 2 0 0 0-2-2H4zm1 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm5-1.757 4.9-4.9a2 2 0 0 0 0-2.828L13.485 5.1a2 2 0 0 0-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgColorSwatch;
