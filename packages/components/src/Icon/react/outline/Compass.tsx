import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgCompass = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <Path
      d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="m9.937 9.903 5.599-1.356-1.415 5.657-5.656 1.414 1.472-5.715Z"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default SvgCompass;
