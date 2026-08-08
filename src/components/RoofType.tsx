import React from 'react';

interface RoofTypeProps {
  value: string;
  selected: boolean;
  onClick: () => void;
}

const RoofType: React.FC<RoofTypeProps> = ({ value, selected, onClick }) => {
  const roofTypes = {
    flat: {
      label: 'Toiture Plate',
      house: 'M40,100 L160,100 L160,150 L40,150 Z',
      roof: 'M40,100 L160,100 L160,90 L40,90 Z'
    },
    mono: {
      label: 'Mono-pente',
      house: 'M40,100 L160,100 L160,150 L40,150 Z',
      roof: 'M40,100 L160,85 L160,100 L40,100 Z'
    },
    dual: {
      label: '2 pans',
      house: 'M40,100 L160,100 L160,150 L40,150 Z',
      roof: 'M40,100 L100,80 L160,100 Z'
    },
    quad: {
      label: '4 pans',
      house: 'M40,100 L160,100 L160,150 L40,150 Z',
      roof: 'M40,100 L60,90 L100,80 L140,90 L160,100 Z'
    },
    other: {
      label: 'Autre',
      house: '',
      roof: ''
    }
  };

  const roofType = roofTypes[value as keyof typeof roofTypes];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-[#00B67A] bg-[#00B67A]/10'
          : 'border-gray-200 hover:border-[#00B67A]/50'
      }`}
    >
      <div className="w-[200px] h-[150px] mx-auto relative bg-[#E8F4FF] rounded-lg p-4">
        {value === 'other' ? (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl text-gray-400">?</span>
          </div>
        ) : (
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full"
            fill="none"
            stroke="none"
          >
            {/* Maison */}
            <path
              d={roofType.house}
              fill="#FF7043"
              className="transition-colors"
            />
            
            {/* Toit */}
            <path
              d={roofType.roof}
              fill="#4B4B4B"
              className="transition-colors"
            />

            {/* Fenêtre */}
            <rect x="70" y="115" width="30" height="20" fill="white" stroke="#4B4B4B" strokeWidth="2" />
            
            {/* Porte */}
            <rect x="110" y="120" width="20" height="30" fill="white" stroke="#4B4B4B" strokeWidth="2" />
          </svg>
        )}
      </div>
      <p className="text-lg font-medium text-[#172162] mt-2">{roofType.label}</p>
    </button>
  );
};

export default RoofType;