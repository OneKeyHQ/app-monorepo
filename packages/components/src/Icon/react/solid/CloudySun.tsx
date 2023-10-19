import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudySun = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10.36 8.132A7 7 0 1 0 9 22h7.5a5.5 5.5 0 0 0 3.102-10.042 5 5 0 1 0-9.241-3.825Zm1.89.667a7.028 7.028 0 0 1 2.508 2.22c.07.1.248.183.431.139a5.508 5.508 0 0 1 2.584-.01 3 3 0 0 0-5.523-2.35ZM15 1a1 1 0 0 1 1 1v.5a1 1 0 1 1-2 0V2a1 1 0 0 1 1-1ZM8.988 3.49a1 1 0 0 1 1.414 0l.354.353a1 1 0 0 1-1.414 1.414l-.354-.353a1 1 0 0 1 0-1.414Zm12.02 0a1 1 0 0 1 0 1.414l-.354.353a1 1 0 1 1-1.414-1.414l.354-.353a1 1 0 0 1 1.414 0ZM21.5 9.5a1 1 0 0 1 1-1h.5a1 1 0 1 1 0 2h-.5a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloudySun;
