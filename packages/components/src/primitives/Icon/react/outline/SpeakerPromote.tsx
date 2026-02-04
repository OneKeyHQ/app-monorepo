import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSpeakerPromote = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19.84 11.197c0-.725-.395-1.357-.98-1.696v3.392c.585-.34.98-.97.98-1.696M8.077 17.08a1.96 1.96 0 0 0 3.633 1.02l-3.633-1.159zm.001-9.568v7.372l8.821 2.815v-13L8.08 7.51Zm-3.923 6.12 1.963.627V8.136l-1.963.627zM18.86 7.4a3.923 3.923 0 0 1 0 7.595v2.703a1.96 1.96 0 0 1-2.556 1.868l-2.7-.862a3.919 3.919 0 0 1-7.488-1.625v-.764L3.56 15.5a1.96 1.96 0 0 1-1.365-1.868v-4.87A1.96 1.96 0 0 1 3.56 6.896l3.127-.998a1 1 0 0 1 .234-.075l9.383-2.993a1.96 1.96 0 0 1 2.556 1.868z" />
  </Svg>
);
export default SvgSpeakerPromote;
