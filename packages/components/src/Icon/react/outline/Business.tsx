import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBusiness = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 20v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4M8 4v3m0 0a2 2 0 1 1-4 0m4 0a2 2 0 1 0 4 0m0-3v3m0 0a2 2 0 1 0 4 0m0-3v3m0 0a2 2 0 1 0 4 0M4 6v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2Z"
    />
  </Svg>
);
export default SvgBusiness;
