import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFileDownload = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7.5 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.172a2 2 0 0 1 1.414.586l4.828 4.828A2 2 0 0 1 19 9.828V19a2 2 0 0 1-2 2h-.5M13 3.5V7a2 2 0 0 0 2 2h3.5M12 14v6m0 0 2.5-2.5M12 20l-2.5-2.5"
    />
  </Svg>
);
export default SvgFileDownload;
