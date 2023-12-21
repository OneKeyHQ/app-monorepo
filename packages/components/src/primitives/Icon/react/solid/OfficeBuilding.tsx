import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgOfficeBuilding = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M20 19V6a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v13H3a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2h-1ZM9 7a1 1 0 0 0 0 2h1a1 1 0 1 0 0-2H9Zm5 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1Zm-5 4a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H9Zm5 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1Zm-5 4a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H9Zm5 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOfficeBuilding;
