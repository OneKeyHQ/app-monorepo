import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgBallFootball = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="m15.315 4.716-1.552 1.127a3 3 0 0 1-3.526 0L8.686 4.716A8.025 8.025 0 0 0 6.098 6.6l.592 1.82a3 3 0 0 1-1.09 3.355L4.05 12.9a7.942 7.942 0 0 0 .988 3.043h1.917a3 3 0 0 1 2.853 2.073l.592 1.823a8.041 8.041 0 0 0 3.2 0l.592-1.823a3 3 0 0 1 2.853-2.073h1.917c.52-.917.865-1.946.988-3.043l-1.55-1.126a3 3 0 0 1-1.09-3.355l.592-1.82a8.025 8.025 0 0 0-2.588-1.883ZM8.466 2.643A9.98 9.98 0 0 1 12 2a9.98 9.98 0 0 1 7.807 3.75 9.963 9.963 0 0 1 2.182 6.716 9.95 9.95 0 0 1-1.632 5.028 10.016 10.016 0 0 1-5.716 4.153C13.8 21.877 12.913 22 12 22s-1.799-.123-2.641-.353a10.016 10.016 0 0 1-5.716-4.153A9.95 9.95 0 0 1 2 12c0-2.364.821-4.538 2.193-6.25a10.022 10.022 0 0 1 4.273-3.107Zm1.77 6.402a3 3 0 0 1 3.527 0l.502.365a3 3 0 0 1 1.09 3.354l-.192.59a3 3 0 0 1-2.853 2.073h-.62a3 3 0 0 1-2.853-2.073l-.192-.59a3 3 0 0 1 1.09-3.354l.502-.365Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBallFootball;
