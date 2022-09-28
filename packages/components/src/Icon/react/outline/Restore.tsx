import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgRestore = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M4 13.04a8 8 0 1 0 .5-4m-.5-5v5h5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default SvgRestore;
