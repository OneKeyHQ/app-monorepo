import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPiano = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 13v8m6-8v8M7.5 4v9h3V4h-3Zm6 0v9h3V4h-3ZM6 21h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgPiano;
