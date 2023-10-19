import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPlaceholder = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 13.5v-3M10.5 4h3m6.5 6.5v3M13.5 20h-3M6 20a2 2 0 0 1-2-2m16 0a2 2 0 0 1-2 2m0-16a2 2 0 0 1 2 2M4 6a2 2 0 0 1 2-2"
    />
  </Svg>
);
export default SvgPlaceholder;
