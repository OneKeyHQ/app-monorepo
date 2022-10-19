import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArchive = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 3a2 2 0 1 0 0 4h12a2 2 0 1 0 0-4H4z" />
    <Path
      fillRule="evenodd"
      d="M3 8h14v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8zm5 3a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArchive;
