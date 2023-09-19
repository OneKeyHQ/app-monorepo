import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgSignal = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6.343 6.343A1 1 0 0 0 4.93 4.93l1.414 1.414Zm2.829 2.829a1 1 0 1 0-1.415-1.415l1.415 1.415Zm-1.415 7.07a1 1 0 0 0 1.415-1.414l-1.415 1.415Zm7.071-1.414a1 1 0 0 0 1.415 1.415l-1.415-1.415Zm1.415-7.07a1 1 0 1 0-1.415 1.414l1.415-1.415ZM4.929 19.07a1 1 0 0 0 1.414-1.414L4.93 19.07Zm12.728-1.414a1 1 0 1 0 1.414 1.414l-1.414-1.414ZM19.07 4.929a1 1 0 1 0-1.414 1.414L19.07 4.93ZM4 11.999c0-2.208.894-4.207 2.343-5.656L4.93 4.93A9.972 9.972 0 0 0 2 11.999h2Zm4 0c0-1.104.447-2.103 1.172-2.827L7.757 7.757A5.984 5.984 0 0 0 6 12h2Zm1.172 2.83A3.985 3.985 0 0 1 8 11.998H6a5.99 5.99 0 0 0 1.757 4.244l1.415-1.415ZM16 11.998a3.984 3.984 0 0 1-1.172 2.83l1.415 1.414A5.984 5.984 0 0 0 18 12h-2Zm-1.172-2.827A3.984 3.984 0 0 1 16 12h2a5.984 5.984 0 0 0-1.757-4.243l-1.415 1.415Zm-8.485 8.485A7.972 7.972 0 0 1 4 12H2a9.972 9.972 0 0 0 2.929 7.071l1.414-1.414ZM20 12a7.97 7.97 0 0 1-2.343 5.657l1.414 1.414A9.972 9.972 0 0 0 22 12h-2Zm-2.343-5.657A7.972 7.972 0 0 1 20 12h2a9.972 9.972 0 0 0-2.929-7.071l-1.414 1.414ZM12 12v2a2 2 0 0 0 2-2h-2Zm0 0h-2a2 2 0 0 0 2 2v-2Zm0 0v-2a2 2 0 0 0-2 2h2Zm0 0h2a2 2 0 0 0-2-2v2Z"
    />
  </Svg>
);
export default SvgSignal;
