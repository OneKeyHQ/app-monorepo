import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBadgeVerified = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="m9.5 12.5 1.146 1.146a.5.5 0 0 0 .707 0L14.5 10.5M8.925 5.26l-2.046-.325a1.03 1.03 0 0 0-1.191 1l-.036 2.07a1.03 1.03 0 0 1-.5.866L3.377 9.937a1.03 1.03 0 0 0-.27 1.532l1.303 1.61c.224.275.29.647.174.983L3.91 16.02a1.03 1.03 0 0 0 .778 1.347l2.033.395c.349.068.638.31.766.642l.741 1.934a1.03 1.03 0 0 0 1.462.532l1.811-1.004a1.03 1.03 0 0 1 1 0l1.81 1.004a1.03 1.03 0 0 0 1.462-.532l.742-1.934a1.03 1.03 0 0 1 .766-.642l2.032-.395a1.03 1.03 0 0 0 .778-1.347l-.674-1.958a1.03 1.03 0 0 1 .173-.984l1.304-1.609a1.03 1.03 0 0 0-.27-1.532l-1.776-1.066a1.03 1.03 0 0 1-.5-.866l-.035-2.07a1.03 1.03 0 0 0-1.192-1l-2.045.324a1.03 1.03 0 0 1-.94-.341l-1.357-1.564a1.03 1.03 0 0 0-1.556 0L9.864 4.918a1.03 1.03 0 0 1-.94.341Z"
    />
  </Svg>
);
export default SvgBadgeVerified;
