import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHandRaised = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11 2a1 1 0 1 0-2 0v6.5a.5.5 0 0 1-1 0V3a1 1 0 1 0-2 0v5.5a.5.5 0 0 1-1 0V5a1 1 0 1 0-2 0v7a7 7 0 1 0 14 0V8a1 1 0 1 0-2 0v3.5a.5.5 0 0 1-1 0V3a1 1 0 1 0-2 0v5.5a.5.5 0 0 1-1 0V2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHandRaised;
