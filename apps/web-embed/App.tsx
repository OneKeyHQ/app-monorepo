import { useEffect, useState } from 'react';

import ReactDOM from 'react-dom/client';

import WebEmbedWebviewAgentCardano from './src/views/WebEmbedWebviewAgentCardano';

const NotFound = () => 'not found';

const getLatestHash = () => window.location.hash.split('#').pop();
const initHash = getLatestHash();

const routerConfig = {
  '/cardano': <WebEmbedWebviewAgentCardano />,
};

function App() {
  const [hashPath, setHashPath] = useState(initHash);
  useEffect(() => {
    window.addEventListener('hashchange', () => {
      setHashPath(getLatestHash);
    });
  }, []);
  return routerConfig[hashPath as keyof typeof routerConfig] || <NotFound />;
}

const root = ReactDOM.createRoot(document.body);
root.render(<App />);
