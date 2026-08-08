import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface SavingsChartProps {
  annualProduction: number;
  currentPrice: number;
}

const SavingsChart: React.FC<SavingsChartProps> = ({ annualProduction, currentPrice }) => {
  // Calcul des économies sur 30 ans avec augmentation de 3% par an
  const data = Array.from({ length: 31 }, (_, year) => {
    const pricePerKwh = currentPrice * Math.pow(1.03, year);
    const annualSavings = annualProduction * pricePerKwh;
    const cumulativeSavings = Array.from({ length: year + 1 }, (_, i) => {
      return annualProduction * (currentPrice * Math.pow(1.03, i));
    }).reduce((a, b) => a + b, 0);

    return {
      year,
      priceKwh: pricePerKwh,
      annualSavings,
      cumulativeSavings
    };
  });

  const formatEuro = (value: number) => `${value.toLocaleString('fr-FR')}€`;

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h4 className="text-lg font-semibold text-[#172162] mb-4">
          Évolution du prix de l'électricité
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="year" 
              label={{ 
                value: 'Années',
                position: 'insideBottom',
                offset: -5
              }}
            />
            <YAxis 
              tickFormatter={(value) => `${value.toFixed(2)}€`}
              label={{
                value: 'Prix du kWh',
                angle: -90,
                position: 'insideLeft'
              }}
            />
            <Tooltip 
              formatter={(value: number) => [`${value.toFixed(2)}€`, 'Prix du kWh']}
              labelFormatter={(year) => `Année ${year}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="priceKwh"
              name="Prix du kWh"
              stroke="#00B67A"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h4 className="text-lg font-semibold text-[#172162] mb-4">
          Économies réalisées
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="year"
              label={{ 
                value: 'Années',
                position: 'insideBottom',
                offset: -5
              }}
            />
            <YAxis 
              tickFormatter={formatEuro}
              label={{
                value: 'Économies (€)',
                angle: -90,
                position: 'insideLeft'
              }}
            />
            <Tooltip 
              formatter={(value: number) => [formatEuro(value), '']}
              labelFormatter={(year) => `Année ${year}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="annualSavings"
              name="Économies annuelles"
              stroke="#4B4B4B"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="cumulativeSavings"
              name="Économies cumulées"
              stroke="#00B67A"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Économies à 10 ans</p>
            <p className="text-2xl font-bold text-[#172162]">
              {formatEuro(data[10].cumulativeSavings)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Économies à 20 ans</p>
            <p className="text-2xl font-bold text-[#172162]">
              {formatEuro(data[20].cumulativeSavings)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Économies à 30 ans</p>
            <p className="text-2xl font-bold text-[#00B67A]">
              {formatEuro(data[30].cumulativeSavings)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Prix du kWh dans 30 ans</p>
            <p className="text-2xl font-bold text-[#172162]">
              {data[30].priceKwh.toFixed(2)}€
            </p>
            <p className="text-xs text-gray-500">
              Avec une augmentation de 3% par an
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SavingsChart;