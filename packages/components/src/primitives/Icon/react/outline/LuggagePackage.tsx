import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLuggagePackage = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1M9 6h6m0 0h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1M7 20v1m0-1h10m0 0v1M9 10v6m6-6v6"
    />
  </Svg>
);
export default SvgLuggagePackage;
