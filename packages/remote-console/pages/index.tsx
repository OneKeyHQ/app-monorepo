import { useEffect } from 'react';

import dynamic from 'next/dynamic';

const PageRemoteConsole = dynamic(() => import('./PageRemoteConsole'), {
  ssr: false,
});

function App() {
  useEffect(() => {
    fetch('/api/remote-console-server');
  }, []);
  return <PageRemoteConsole />;
}

export default App;
