import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDownloadSquare = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v5m0 0 2-2m-2 2-2-2m-1 5h6m-9 4h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgDownloadSquare;
