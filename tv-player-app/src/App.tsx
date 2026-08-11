import { lazy, Suspense, useEffect, useState } from 'react';

const ControlPage = lazy(() => import('./pages/ControlPage'));
const PlayerPage = lazy(() => import('./pages/PlayerPage'));

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1).split('?')[0] || '/');

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash.slice(1).split('?')[0] || '/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <Suspense fallback={<div className="h-screen bg-[#060e1c]" />}>
      {route === '/player' ? <PlayerPage /> : <ControlPage />}
    </Suspense>
  );
}
