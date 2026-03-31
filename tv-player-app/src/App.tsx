import { Route, Routes } from 'react-router-dom';
import ControlPage from './pages/ControlPage';
import PlayerPage from './pages/PlayerPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ControlPage />} />
      <Route path="/player" element={<PlayerPage />} />
    </Routes>
  );
}
