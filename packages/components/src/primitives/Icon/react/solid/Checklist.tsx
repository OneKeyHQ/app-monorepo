import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChecklist = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9.1 5.2a1 1 0 0 1 .2 1.4l-3 4a1 1 0 0 1-1.355.232l-1.5-1a1 1 0 0 1 1.11-1.664l.713.475L7.7 5.4a1 1 0 0 1 1.4-.2ZM12 8a1 1 0 0 1 1-1h7a1 1 0 1 1 0 2h-7a1 1 0 0 1-1-1Zm-2.9 5.2a1 1 0 0 1 .2 1.4l-3 4a1 1 0 0 1-1.355.232l-1.5-1a1 1 0 1 1 1.11-1.664l.713.475L7.7 13.4a1 1 0 0 1 1.4-.2ZM12 16a1 1 0 0 1 1-1h7a1 1 0 1 1 0 2h-7a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChecklist;
