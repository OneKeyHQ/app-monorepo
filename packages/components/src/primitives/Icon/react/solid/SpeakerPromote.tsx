import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSpeakerPromote = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16.305 2.827a1.96 1.96 0 0 1 2.555 1.868V7.4a3.923 3.923 0 0 1 0 7.596V17.7a1.96 1.96 0 0 1-2.555 1.868l-2.7-.86a3.921 3.921 0 0 1-7.489-1.628v-.764L3.56 15.5a1.96 1.96 0 0 1-1.365-1.867v-4.87A1.96 1.96 0 0 1 3.56 6.894L6.68 5.9a1 1 0 0 1 .143-.054l9.482-3.018ZM8.077 16.948v.13a1.96 1.96 0 0 0 3.632 1.026zm11.763-5.751a1.96 1.96 0 0 1-.98 1.698V9.5c.586.339.98.972.98 1.698ZM6.118 8.136v6.122l-1.963-.626v-4.87z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSpeakerPromote;
