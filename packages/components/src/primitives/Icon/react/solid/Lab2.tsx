import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLab2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M21.004 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1-3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12.291 3.294a1 1 0 0 1 1.415-.002l1.005 1 5.001 5.002.997 1a1 1 0 0 1-1.418 1.412l-.289-.29-2.266 2.265a1.004 1.004 0 0 1-.051.052l-6.978 6.975a4.536 4.536 0 0 1-6.413-6.415L12.588 5l-.294-.293a1 1 0 0 1-.003-1.414Zm1.713 3.12L8.416 12h7.173l2-2-3.585-3.586Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLab2;
