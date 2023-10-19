import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUpload = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 12.75V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5.25M12 4v11.25M12 4l4.5 4.5M12 4 7.5 8.5"
    />
  </Svg>
);
export default SvgUpload;
