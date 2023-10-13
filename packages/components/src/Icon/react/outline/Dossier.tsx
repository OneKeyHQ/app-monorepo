import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDossier = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 5h7v4m-1-4h5a2 2 0 0 1 2 2v5M9 9V5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9H9Z"
    />
  </Svg>
);
export default SvgDossier;
