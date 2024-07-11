import { useState } from 'react';

import { SectionPressItem } from './SectionPressItem';

export function CrashDevSettings() {
  const [text, setText] = useState({ a: { b: { c: 'text' } } });
  return (
    <SectionPressItem
      title={`${'Crash Test'} ${text.a.b.c}`}
      onPress={() => {
        setText('' as unknown as typeof text);
      }}
    />
  );
}
