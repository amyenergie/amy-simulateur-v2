import React from 'react';
import { AlertCircle } from 'lucide-react';

interface EnergyBillFormProps {
  billType: 'monthly' | 'annual';
  unit: 'euros' | 'kwh';
  value: string;
  onBillTypeChange: (type: 'monthly' | 'annual') => void;
  onUnitChange: (unit: 'euros' | 'kwh') => void;
  onChange: (value: string) => void;
  error?: string;
}

const EnergyBillForm: React.FC<EnergyBillFormProps> = ({
  billType,
  unit,
  value,
  onBillTypeChange,
  onUnitChange,
  onChange,
  error
}) => {
  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-6">
        <button
          type="button"
          onClick={() => onBillTypeChange('monthly')}
          className={`flex-1 p-4 rounded-lg border-2 transition-all ${
            billType === 'monthly'
              ? 'border-[#00B67A] bg-[#00B67A]/10'
              : 'border-gray-200'
          }`}
        >
          <p className="text-lg font-medium text-[#172162]">Mensuel</p>
        </button>
        <button
          type="button"
          onClick={() => onBillTypeChange('annual')}
          className={`flex-1 p-4 rounded-lg border-2 transition-all ${
            billType === 'annual'
              ? 'border-[#00B67A] bg-[#00B67A]/10'
              : 'border-gray-200'
          }`}
        >
          <p className="text-lg font-medium text-[#172162]">Annuel</p>
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          type="button"
          onClick={() => onUnitChange('euros')}
          className={`flex-1 p-4 rounded-lg border-2 transition-all ${
            unit === 'euros'
              ? 'border-[#00B67A] bg-[#00B67A]/10'
              : 'border-gray-200'
          }`}
        >
          <p className="text-lg font-medium text-[#172162]">Euros (€)</p>
        </button>
        <button
          type="button"
          onClick={() => onUnitChange('kwh')}
          className={`flex-1 p-4 rounded-lg border-2 transition-all ${
            unit === 'kwh'
              ? 'border-[#00B67A] bg-[#00B67A]/10'
              : 'border-gray-200'
          }`}
        >
          <p className="text-lg font-medium text-[#172162]">Kilowatts (kWh)</p>
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {`Montant ${billType === 'monthly' ? 'mensuel' : 'annuel'} en ${unit === 'euros' ? '€' : 'kWh'}`}
        </label>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-4 py-2 rounded-lg border ${
            error ? 'border-red-500' : 'border-gray-300'
          } focus:outline-none focus:ring-2 focus:ring-[#00B67A]`}
          placeholder={`Entrez votre consommation ${billType === 'monthly' ? 'mensuelle' : 'annuelle'}`}
        />
        {error && (
          <div className="flex items-center mt-1 text-red-500 text-sm">
            <AlertCircle className="w-4 h-4 mr-1" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnergyBillForm;