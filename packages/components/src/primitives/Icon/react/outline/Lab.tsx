import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLab = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M9 7v4c-1.135 1.42-3.086 3.11-3.762 5M9 7h6M9 7H8m7 0v4c1.136 1.42 3.086 3.11 3.762 5M15 7h1m2.762 9c.15.423.238.856.238 1.298A3.702 3.702 0 0 1 15.298 21H8.702A3.702 3.702 0 0 1 5 17.298c0-.442.087-.875.238-1.298m13.524 0s-2.587.545-4.262.5c-1.99-.053-3.01-.947-5-1-1.675-.045-4.262.5-4.262.5"
    />
    <Path
      fill="currentColor"
      d="M11 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4-1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
    />
  </Svg>
);
export default SvgLab;
