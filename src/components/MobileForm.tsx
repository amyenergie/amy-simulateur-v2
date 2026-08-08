import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Home, Building2, Ruler, Users, Send, AlertCircle,
  User, Mail, Phone, MapPin
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FormData {
  address: string;
  coordinates: { lat: number; lng: number } | null;
  buildingType: 'house' | 'apartment' | '';
  surface: '50' | '50-100' | '100-150' | '150+' | '';
  residents: string;
  heatingType: 'electric' | 'gas' | 'fuel' | 'wood' | 'other' | '';
  billType: 'monthly' | 'annual';
  billUnit: 'euros' | 'kwh';
  billValue: string;
  roofType: 'flat' | 'mono' | 'dual' | 'quad' | 'other' | '';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const MobileForm: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    address: '',
    coordinates: null,
    buildingType: '',
    surface: '',
    residents: '',
    heatingType: '',
    billType: 'monthly',
    billUnit: 'euros',
    billValue: '',
    roofType: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleNext = async () => {
    if (validateStep()) {
      if (currentStep === 1) {
        // Enregistrer dans Supabase dès que l'adresse est saisie
        try {
          const { error } = await supabase
            .from('solar_projects')
            .insert([{
              address: formData.address,
              coordinates: formData.coordinates ? `(${formData.coordinates.lat},${formData.coordinates.lng})` : null,
              first_name: formData.firstName,
              last_name: formData.lastName,
              email: formData.email,
              phone: formData.phone
            }]);

          if (error) throw error;
          
          setCurrentStep(prev => prev + 1);
        } catch (error) {
          console.error("Erreur lors de l'enregistrement:", error);
        }
      } else {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const validateStep = () => {
    const newErrors: Partial<FormData> = {};
    
    if (currentStep === 1) {
      if (!formData.address) newErrors.address = "L'adresse est requise";
      if (!formData.firstName) newErrors.firstName = "Le prénom est requis";
      if (!formData.lastName) newErrors.lastName = "Le nom est requis";
      if (!formData.email) newErrors.email = "L'email est requis";
      if (!formData.phone) newErrors.phone = "Le téléphone est requis";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <div className="min-h-screen bg-[#ECECEC] flex flex-col">
      <div className="flex-1 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-4"
        >
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-[#172162]">
                Où se situe votre projet ?
              </h2>
              
              <div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#00B67A]"
                    placeholder="Votre adresse"
                  />
                </div>
                {errors.address && (
                  <p className="mt-1 text-sm text-red-500">{errors.address}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#00B67A]"
                      placeholder="Prénom"
                    />
                  </div>
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#00B67A]"
                      placeholder="Nom"
                    />
                  </div>
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#00B67A]"
                    placeholder="Email"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              <div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#00B67A]"
                    placeholder="Téléphone"
                  />
                </div>
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={handleNext}
              disabled={isSaving}
              className="w-full py-3 bg-[#00B67A] text-white rounded-lg flex items-center justify-center"
            >
              {isSaving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Continuer
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MobileForm;