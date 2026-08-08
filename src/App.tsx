import { Routes, Route, Navigate } from 'react-router-dom';
import SolarForm from './components/SolarForm';
import ResultsPage from './components/ResultsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<SolarForm />} />
      <Route path="/results" element={<ResultsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;