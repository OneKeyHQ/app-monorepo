import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgIdentification = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10 2a1 1 0 0 0-1 1v1a1 1 0 0 0 2 0V3a1 1 0 0 0-1-1zM4 4h3a3 3 0 0 0 6 0h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm2.5 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm2.45 4a2.5 2.5 0 1 0-4.9 0h4.9zM12 9a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2h-3zm-1 4a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgIdentification;
