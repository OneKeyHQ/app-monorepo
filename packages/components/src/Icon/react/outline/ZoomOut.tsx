import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgZoomOut = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0zm-4 0H7"
    />
  </Svg>
);
export default SvgZoomOut;
