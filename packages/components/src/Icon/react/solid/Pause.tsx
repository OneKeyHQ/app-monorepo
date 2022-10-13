import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgPause = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zM7 8a1 1 0 0 1 2 0v4a1 1 0 1 1-2 0V8zm5-1a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgPause;
