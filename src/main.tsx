import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LoadScript } from '@react-google-maps/api';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { initGoogleAdsTag } from './lib/analytics';

initGoogleAdsTag();

const libraries: ("places" | "drawing" | "geometry" | "localContext" | "visualization")[] = ["places"];

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LoadScript 
        googleMapsApiKey="AIzaSyCDNh9_8-PUo1AJ6DgzPV0I_-3lsir8Pd0"
        libraries={libraries}
        loadingElement={
          <div className="min-h-screen bg-[#ECECEC] flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00B67A] mx-auto mb-4"></div>
              <p className="text-[#172162] font-medium">Chargement de Google Maps...</p>
            </div>
          </div>
        }
        language="fr"
        region="FR"
      >
        <App />
      </LoadScript>
    </BrowserRouter>
  </StrictMode>
);