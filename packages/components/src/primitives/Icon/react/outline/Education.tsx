import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEducation = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m17.5 12.294-5.12 2.328a.92.92 0 0 1-.76 0L6.5 12.294v3.236l5.5 2.946 5.5-2.946zM4.131 9.204 12 12.78l7.868-3.576L12 5.627zM23 15.62a.917.917 0 0 1-1.833 0v-4.994l-1.834.834v4.07c0 .675-.372 1.296-.967 1.615l-5.5 2.947c-.541.29-1.191.29-1.732 0l-5.5-2.947a1.83 1.83 0 0 1-.967-1.616v-4.07l-3.13-1.422a.917.917 0 0 1 0-1.668L11.62 3.786a.92.92 0 0 1 .76 0L22.463 8.37a.92.92 0 0 1 .537.834z" />
  </Svg>
);
export default SvgEducation;
