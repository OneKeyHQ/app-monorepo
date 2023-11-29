import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageLike = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.002 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10.036a2 2 0 0 1-2 2h-2.626a1 1 0 0 0-.638.23l-2.74 2.27-2.704-2.267a1 1 0 0 0-.642-.233h-2.65a2 2 0 0 1-2-2V6Z"
    />
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.251 10.668c0 2.077-2.98 3.612-3.251 3.612-.27 0-3.251-1.535-3.251-3.612 0-1.445.903-2.168 1.806-2.168S12 9.042 12 9.042s.542-.542 1.445-.542 1.806.723 1.806 2.168Z"
    />
  </Svg>
);
export default SvgMessageLike;
