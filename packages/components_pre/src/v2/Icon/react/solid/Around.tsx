import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgAround = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 7.99v9.8a1.6 1.6 0 0 0 .204.12c.371.188.973.386 1.797.56.47.1.999-.277.999-.91V9.582c0-.49-.378-.958-.955-1.065A13.408 13.408 0 0 1 4 7.99Zm16 0v9.8a1.779 1.779 0 0 1-.204.12c-.371.188-.973.386-1.797.56-.47.1-.999-.277-.999-.91V9.582c0-.49.378-.958.955-1.065A13.407 13.407 0 0 0 20 7.99ZM22 6v12c0 .48-.23.852-.47 1.105a3.032 3.032 0 0 1-.829.588c-.595.302-1.39.544-2.288.734-1.862.394-3.413-1.12-3.413-2.868v-.442A37.4 37.4 0 0 0 12 17a37.4 37.4 0 0 0-3 .117v.442c0 1.749-1.551 3.262-3.413 2.868-.897-.19-1.693-.432-2.288-.734a3.032 3.032 0 0 1-.83-.588C2.23 18.852 2 18.479 2 18V6c0-.464.216-.83.447-1.08.226-.246.512-.435.795-.584.569-.298 1.326-.537 2.177-.726C7.138 3.228 9.464 3 12 3c2.536 0 4.862.228 6.58.61.852.189 1.61.428 2.178.726.283.15.569.338.795.584.23.25.447.616.447 1.08Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAround;
