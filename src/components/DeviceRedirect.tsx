import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DeviceRedirect: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    if (isMobile) {
      navigate('/mobile');
    } else {
      navigate('/desktop');
    }
  }, [navigate]);

  return null;
};

export default DeviceRedirect;