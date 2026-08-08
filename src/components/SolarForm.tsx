import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleMap, Marker, StandaloneSearchBox } from "@react-google-maps/api";
import {
  Home,
  Building2,
  Users,
  Ruler,
  ChevronRight,
  ChevronLeft,
  Send,
  AlertCircle,
  Locate,
  User,
  Mail,
  Phone,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { trackQuoteConversion } from "../lib/analytics";
import PreconisationLoader from "./PreconisationLoader";

const FUNCTIONS_BASE = import.meta.env.PROD ? "" : "https://amyenergie.netlify.app";

interface FormData {
  address: string;
  coordinates: { lat: number; lng: number } | null;
  buildingType: "house" | "apartment" | "";
  surface: "50" | "50-100" | "100-150" | "150+" | "";
  residents: string;
  heatingType: "electric" | "gas" | "fuel" | "wood" | "other" | "";
  billType: "monthly" | "annual";
  billUnit: "euros" | "kwh";
  billValue: string;
  roofType: "flat" | "mono" | "dual" | "quad" | "other" | "";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message?: string;
}

const defaultCenter = { lat: 43.269827, lng: 5.395887 };

const containerStyle = { width: "100%", height: "440px" };

const getPriceRange = (power: number): { min: number; max: number } => {
  switch (power) {
    case 3:
      return { min: 5000, max: 10000 };
    case 6:
      return { min: 11000, max: 16000 };
    case 9:
      return { min: 14000, max: 20000 };
    case 12:
      return { min: 18000, max: 24000 };
    case 15:
      return { min: 22000, max: 28000 };
    default: {
      const ratio = power / 9;
      return { min: Math.round(14000 * ratio), max: Math.round(20000 * ratio) };
    }
  }
};

function toNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function gradeFromSpecific(s: number | null) {
  if (!s) return { grade: "—", label: "Sélectionne une maison" };
  if (s >= 1500) return { grade: "A", label: "Excellent gisement solaire" };
  if (s >= 1350) return { grade: "B", label: "Très bon gisement solaire" };
  if (s >= 1200) return { grade: "C", label: "Bon gisement solaire" };
  return { grade: "D", label: "Gisement correct" };
}

function badgeClasses(grade: string) {
  if (grade === "A") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (grade === "B") return "bg-green-100 text-green-900 border-green-200";
  if (grade === "C") return "bg-yellow-100 text-yellow-900 border-yellow-200";
  if (grade === "D") return "bg-orange-100 text-orange-900 border-orange-200";
  return "bg-gray-100 text-[#1A1D29] border-[#E5E3DD]";
}

export default function SolarForm() {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);

  const [formData, setFormData] = useState<FormData>({
    address: "",
    coordinates: null,
    buildingType: "",
    surface: "",
    residents: "",
    heatingType: "",
    billType: "monthly",
    billUnit: "euros",
    billValue: "",
    roofType: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    message: "",
  });

  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const [showLoader, setShowLoader] = useState(false);
  const [pendingNavigate, setPendingNavigate] = useState<null | (() => void)>(null);

  const [pvgisData, setPvgisData] = useState<any>(null);
  const [pvgisLoading, setPvgisLoading] = useState(false);
  const [pvgisError, setPvgisError] = useState<string | null>(null);

  const pvPeakpower = 6;
  const pvAngle = 35;
  const pvAspect = 0;
  const pvLoss = 14;

  const calculateRecommendedPower = () => {
    let annualConsumption: number;

    if (formData.billUnit === "kwh") {
      annualConsumption =
        formData.billType === "monthly"
          ? parseFloat(formData.billValue) * 12
          : parseFloat(formData.billValue);
    } else {
      const euros =
        formData.billType === "monthly"
          ? parseFloat(formData.billValue) * 12
          : parseFloat(formData.billValue);
      annualConsumption = euros / 0.28;
    }

    const recommendedPower = Math.ceil((annualConsumption / 4500) * 3);
    return Math.ceil(recommendedPower / 3) * 3;
  };

  const powerRecommendation = useMemo(() => {
    if (!formData.billValue) return null;
    return calculateRecommendedPower();
  }, [formData.billValue, formData.billType, formData.billUnit]);

  const priceRange = useMemo(() => {
    if (!powerRecommendation) return null;
    return getPriceRange(powerRecommendation);
  }, [powerRecommendation]);

  useEffect(() => {
    const coords = formData.coordinates;
    if (!coords?.lat || !coords?.lng) return;

    let cancelled = false;

    async function run() {
      setPvgisLoading(true);
      setPvgisError(null);

      try {
        const qs = new URLSearchParams({
          lat: String(coords.lat),
          lon: String(coords.lng),
          peakpower: String(pvPeakpower),
          angle: String(pvAngle),
          aspect: String(pvAspect),
          loss: String(pvLoss),
        });

        const r = await fetch(`${FUNCTIONS_BASE}/.netlify/functions/irradiation?${qs.toString()}`);
        const j = await r.json();

        if (!r.ok) throw new Error(j?.error || "Erreur PVGIS");
        if (!cancelled) setPvgisData(j);
      } catch (e: any) {
        if (!cancelled) setPvgisError(String(e?.message ?? e));
      } finally {
        if (!cancelled) setPvgisLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [formData.coordinates?.lat, formData.coordinates?.lng]);

  async function sendLeadToGoogleSheets(payload: any) {
    try {
      const r = await fetch(`${FUNCTIONS_BASE}/.netlify/functions/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const t = await r.text().catch(() => "");
      if (!r.ok) console.warn("Lead non envoyé:", r.status, t);
    } catch (e) {
      console.warn("Lead non envoyé:", e);
    }
  }

  const handleGeolocation = () => {
    if (!navigator.geolocation) return;

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setPvgisData(null);
        setPvgisError(null);

        setMapCenter({ lat, lng });
        setFormData((prev) => ({ ...prev, coordinates: { lat, lng } }));

        fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=AIzaSyCDNh9_8-PUo1AJ6DgzPV0I_-3lsir8Pd0`
        )
          .then((r) => r.json())
          .then((data) => {
            if (data.results && data.results[0]) {
              setFormData((prev) => ({ ...prev, address: data.results[0].formatted_address }));
            }
          })
          .finally(() => setIsLocating(false));
      },
      (error) => {
        console.error("Erreur géolocalisation:", error);
        setIsLocating(false);
      }
    );
  };

  const onLoadSearchBox = (ref: google.maps.places.SearchBox) => setSearchBox(ref);

  const onPlacesChanged = () => {
    if (!searchBox) return;
    const places = searchBox.getPlaces();
    if (!places || places.length === 0) return;

    const place = places[0];
    if (!place.geometry || !place.geometry.location) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();

    setPvgisData(null);
    setPvgisError(null);

    setMapCenter({ lat, lng });
    setFormData((prev) => ({
      ...prev,
      address: place.formatted_address || "",
      coordinates: { lat, lng },
    }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value } as any));
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name as keyof FormData]: undefined }));
    }
  };

  const validateStep = () => {
    const newErrors: any = {};

    switch (currentStep) {
      case 1:
        if (!formData.address) newErrors.address = "L'adresse est requise";
        if (!formData.coordinates) newErrors.coordinates = "Veuillez sélectionner une adresse valide";
        break;
      case 2:
        if (!formData.buildingType) newErrors.buildingType = "Le type de bien est requis";
        break;
      case 3:
        if (!formData.surface) newErrors.surface = "La surface est requise";
        break;
      case 4:
        if (!formData.residents) newErrors.residents = "Le nombre d'habitants est requis";
        break;
      case 5:
        if (!formData.heatingType) newErrors.heatingType = "Le type de chauffage est requis";
        break;
      case 6:
        if (!formData.billValue) newErrors.billValue = "Le montant est requis";
        break;
      case 7:
        if (!formData.roofType) newErrors.roofType = "Le type de toiture est requis";
        break;
      case 8:
        if (!formData.firstName) newErrors.firstName = "Le prénom est requis";
        if (!formData.lastName) newErrors.lastName = "Le nom est requis";
        if (!formData.email) newErrors.email = "L'email est requis";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Email invalide";
        if (!formData.phone) newErrors.phone = "Le téléphone est requis";
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (currentStep === 8) handleSubmit();
    else setCurrentStep((p) => p + 1);
  };

  const handlePrevious = () => setCurrentStep((p) => p - 1);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const hardTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout envoi (15s)")), 15000)
    );

    try {
      const annual = toNumber(pvgisData?.outputs?.totals?.fixed?.E_y);
      const specific = annual ? Math.round(annual / pvPeakpower) : null;
      const g = gradeFromSpecific(specific);
      const techSummary = `Gisement ${g.grade} | Spécifique ${specific ?? "—"} kWh/kWc/an | Hypothèses: ${pvPeakpower} kWc, pente ${pvAngle}°, azimut ${pvAspect}°, pertes ${pvLoss}%`;

      const resultsState = {
        powerRecommendation,
        priceRange,
        monthlyBill:
          formData.billType === "monthly"
            ? parseFloat(formData.billValue)
            : parseFloat(formData.billValue) / 12,
        formData,
        pvgis: pvgisData,
        pvgisParams: { pvPeakpower, pvAngle, pvAspect, pvLoss },
        techSummary,
      };

      sessionStorage.setItem("amy_results", JSON.stringify(resultsState));

      // Lead Google Sheet (non bloquant)
      sendLeadToGoogleSheets({
        type: "lead",
        callbackRequested: true,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        lat: formData.coordinates?.lat,
        lon: formData.coordinates?.lng,
        powerRecommendation,
        priceRange,
        techSummary,
      });

      // Conversion Google Ads : le formulaire de devis vient d'etre soumis avec succes.
      trackQuoteConversion();

      // Supabase avec timeout anti blocage
      await Promise.race([
        supabase.from("solar_projects").insert([
          {
            address: formData.address,
            coordinates: `(${formData.coordinates?.lat},${formData.coordinates?.lng})`,
            building_type: formData.buildingType,
            surface: formData.surface,
            residents: formData.residents ? parseInt(formData.residents) : null,
            heating_type: formData.heatingType,
            bill_type: formData.billType,
            bill_unit: formData.billUnit,
            bill_value: formData.billValue ? parseFloat(formData.billValue) : null,
            roof_type: formData.roofType,
            power_recommendation: powerRecommendation,
            first_name: formData.firstName,
            last_name: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            message: formData.message || null,
          },
        ]),
        hardTimeout,
      ]).then((res: any) => {
        if (res?.error) throw res.error;
      });

      // Prevenir la page parente (iframe amy-energie.fr) que le devis a ete soumis,
      // pour que le compte de conversion Google Ads cote WordPress se declenche.
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "amy_quote_submitted" }, "https://amy-energie.fr");
        }
      } catch (e) {
        console.warn("postMessage vers le parent impossible:", e);
      }

      // Loader puis navigation
      setPendingNavigate(() => () => navigate("/results", { state: resultsState }));
      setShowLoader(true);
    } catch (e: any) {
      console.error("Submit error:", e);
      alert("Envoi impossible pour le moment. Réessaie dans quelques secondes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showLoader && pendingNavigate) {
    return (
      <PreconisationLoader
        address={formData.address}
        onDone={() => {
          setShowLoader(false);
          pendingNavigate();
        }}
      />
    );
  }

  const annual = toNumber(pvgisData?.outputs?.totals?.fixed?.E_y);
  const specific = annual ? Math.round(annual / pvPeakpower) : null;
  const g = gradeFromSpecific(specific);

  return (
    <div className="min-h-screen w-full bg-white flex flex-col" style={{ fontFamily: "'Lato', sans-serif" }}>
      <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col px-6 py-10 md:py-14">
        <div className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <span className="text-[15px] font-extrabold text-[#1A1D29] tracking-tight">AMY ENERGIE</span>
            <span className="text-xs font-medium text-[#6B6F7B] bg-[#F5F4F1] border border-[#E5E3DD] rounded-full px-3 py-1.5">
              Étape {currentStep}/8
            </span>
          </div>
          <div className="h-1 bg-[#E5E3DD] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#E0592E] rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / 8) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 w-full"
            >
              <h3 className="text-[26px] md:text-3xl font-extrabold text-[#1A1D29] mb-6 text-center">Où se situe votre projet ?</h3>

              <div className="space-y-4">
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-[#6B6F7B] mb-1">
                    Adresse complète
                  </label>

                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <StandaloneSearchBox onLoad={onLoadSearchBox} onPlacesChanged={onPlacesChanged}>
                        <input
                          type="text"
                          id="address"
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 rounded-lg border ${
                            errors.address ? "border-red-500" : "border-[#E5E3DD]"
                          } bg-[#F5F4F1] focus:outline-none focus:ring-2 focus:ring-[#E0592E] focus:bg-white`}
                          placeholder="Saisissez votre adresse"
                        />
                      </StandaloneSearchBox>
                    </div>

                    <button
                      type="button"
                      onClick={handleGeolocation}
                      disabled={isLocating}
                      className={`px-4 py-2 bg-black text-white rounded-lg hover:bg-[#1A1A1A] transition-colors ${
                        isLocating ? "opacity-70 cursor-not-allowed" : ""
                      }`}
                      title="Me géolocaliser"
                    >
                      <Locate className={`w-5 h-5 ${isLocating ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {errors.address && (
                    <div className="flex items-center mt-1 text-red-500 text-sm">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.address}
                    </div>
                  )}
                </div>

                <div className="rounded-lg overflow-hidden border border-[#E5E3DD]">
                  <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={mapCenter}
                    zoom={18}
                    mapTypeId="satellite"
                    onClick={(e) => {
                      if (!e.latLng) return;
                      const lat = e.latLng.lat();
                      const lng = e.latLng.lng();

                      setPvgisData(null);
                      setPvgisError(null);

                      setFormData((prev) => ({ ...prev, coordinates: { lat, lng } }));

                      fetch(
                        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=AIzaSyCDNh9_8-PUo1AJ6DgzPV0I_-3lsir8Pd0`
                      )
                        .then((r) => r.json())
                        .then((data) => {
                          if (data.results && data.results[0]) {
                            setFormData((prev) => ({
                              ...prev,
                              address: data.results[0].formatted_address,
                              coordinates: { lat, lng },
                            }));
                          }
                        });
                    }}
                  >
                    {formData.coordinates && <Marker position={formData.coordinates} />}
                  </GoogleMap>
                </div>

                <div className="rounded-xl border border-[#E5E3DD] bg-[#F5F4F1] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-[#6B6F7B]">Ensoleillement estimé</div>
                      <div className="text-xl text-[#1A1D29] mt-1">
                        {pvgisLoading
                          ? "Calcul en cours…"
                          : specific
                            ? `${specific.toLocaleString("fr-FR")} kWh/kWc/an`
                            : "—"}
                      </div>
                      <div className="text-xs text-[#6B6F7B] mt-1">
                        Calcul PVGIS automatique, validé à l’étude.
                      </div>
                      {pvgisError && <div className="text-xs text-red-600 mt-2">PVGIS indisponible.</div>}
                    </div>

                    <div
                      className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-sm ${badgeClasses(
                        g.grade
                      )}`}
                    >
                      {g.label} ({g.grade})
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <h3 className="text-[26px] md:text-3xl font-extrabold text-[#1A1D29] mb-6 text-center">Quel est votre type d'habitation ?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setFormData((p) => ({ ...p, buildingType: "house" }));
                    setCurrentStep((s) => s + 1);
                  }}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    formData.buildingType === "house" ? "border-[#E0592E] bg-[#FDEDE6]" : "border-[#E5E3DD] hover:border-[#E0592E]/50"
                  }`}
                >
                  <Home className="w-12 h-12 mb-4 mx-auto text-[#1A1D29]" />
                  <p className="text-lg font-medium text-[#1A1D29]">Maison</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormData((p) => ({ ...p, buildingType: "apartment" }));
                    setCurrentStep((s) => s + 1);
                  }}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    formData.buildingType === "apartment" ? "border-[#E0592E] bg-[#FDEDE6]" : "border-[#E5E3DD] hover:border-[#E0592E]/50"
                  }`}
                >
                  <Building2 className="w-12 h-12 mb-4 mx-auto text-[#1A1D29]" />
                  <p className="text-lg font-medium text-[#1A1D29]">Appartement</p>
                </button>
              </div>
              {errors.buildingType && (
                <div className="flex items-center mt-1 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.buildingType}
                </div>
              )}
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <h3 className="text-[26px] md:text-3xl font-extrabold text-[#1A1D29] mb-6 text-center">Quelle est la surface de votre logement ?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { value: "50", label: "Moins de 50m²" },
                  { value: "50-100", label: "Entre 50m² et 100m²" },
                  { value: "100-150", label: "Entre 100m² et 150m²" },
                  { value: "150+", label: "Plus de 150m²" },
                ].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      setFormData((p) => ({ ...p, surface: o.value as any }));
                      setCurrentStep((s) => s + 1);
                    }}
                    className={`p-6 rounded-xl border-2 transition-all ${
                      formData.surface === o.value ? "border-[#E0592E] bg-[#FDEDE6]" : "border-[#E5E3DD] hover:border-[#E0592E]/50"
                    }`}
                  >
                    <Ruler className="w-8 h-8 mb-4 mx-auto text-[#1A1D29]" />
                    <p className="text-lg font-medium text-[#1A1D29]">{o.label}</p>
                  </button>
                ))}
              </div>
              {errors.surface && (
                <div className="flex items-center mt-1 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.surface}
                </div>
              )}
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <h3 className="text-[26px] md:text-3xl font-extrabold text-[#1A1D29] mb-6 text-center">Combien d'habitants permanents ?</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setFormData((p) => ({ ...p, residents: String(num) }));
                      setCurrentStep((s) => s + 1);
                    }}
                    className={`p-6 rounded-xl border-2 transition-all ${
                      formData.residents === String(num) ? "border-[#E0592E] bg-[#FDEDE6]" : "border-[#E5E3DD] hover:border-[#E0592E]/50"
                    }`}
                  >
                    <Users className="w-6 h-6 mb-2 mx-auto text-[#1A1D29]" />
                    <p className="text-lg font-medium text-[#1A1D29]">{num}</p>
                  </button>
                ))}
              </div>
              {errors.residents && (
                <div className="flex items-center mt-1 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.residents}
                </div>
              )}
            </motion.div>
          )}

          {currentStep === 5 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <h3 className="text-[26px] md:text-3xl font-extrabold text-[#1A1D29] mb-6 text-center">Quel est votre mode de chauffage ?</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { value: "electric", label: "Électricité" },
                  { value: "gas", label: "Gaz" },
                  { value: "fuel", label: "Fioul" },
                  { value: "wood", label: "Bois" },
                  { value: "other", label: "Autre" },
                ].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      setFormData((p) => ({ ...p, heatingType: o.value as any }));
                      setCurrentStep((s) => s + 1);
                    }}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.heatingType === o.value ? "border-[#E0592E] bg-[#FDEDE6]" : "border-[#E5E3DD] hover:border-[#E0592E]/50"
                    }`}
                  >
                    <p className="text-lg font-medium text-[#1A1D29]">{o.label}</p>
                  </button>
                ))}
              </div>
              {errors.heatingType && (
                <div className="flex items-center mt-1 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.heatingType}
                </div>
              )}
            </motion.div>
          )}

          {currentStep === 6 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <h3 className="text-[26px] md:text-3xl font-extrabold text-[#1A1D29] mb-6 text-center">Votre consommation énergétique</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={formData.billValue}
                      onChange={(e) => setFormData((p) => ({ ...p, billValue: e.target.value }))}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        (errors as any).billValue ? "border-red-500" : "border-[#E5E3DD]"
                      } focus:outline-none focus:ring-2 focus:ring-[#E0592E]`}
                      placeholder="Entrez votre consommation"
                    />
                  </div>

                  <select
                    value={formData.billUnit}
                    onChange={(e) => setFormData((p) => ({ ...p, billUnit: e.target.value as any }))}
                    className="px-4 py-3 rounded-lg border border-[#E5E3DD] focus:outline-none focus:ring-2 focus:ring-[#E0592E] bg-white"
                  >
                    <option value="euros">€</option>
                    <option value="kwh">kWh</option>
                  </select>

                  <select
                    value={formData.billType}
                    onChange={(e) => setFormData((p) => ({ ...p, billType: e.target.value as any }))}
                    className="px-4 py-3 rounded-lg border border-[#E5E3DD] focus:outline-none focus:ring-2 focus:ring-[#E0592E] bg-white"
                  >
                    <option value="monthly">/ mois</option>
                    <option value="annual">/ an</option>
                  </select>
                </div>

                {(errors as any).billValue && (
                  <div className="flex items-center mt-1 text-red-500 text-sm">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {(errors as any).billValue}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {currentStep === 7 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <h3 className="text-[26px] md:text-3xl font-extrabold text-[#1A1D29] mb-6 text-center">Quel est votre type de toiture ?</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { value: "flat", label: "Toiture plate" },
                  { value: "mono", label: "Mono-pente" },
                  { value: "dual", label: "2 pans" },
                  { value: "quad", label: "4 pans" },
                  { value: "other", label: "Autre" },
                ].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      setFormData((p) => ({ ...p, roofType: o.value as any }));
                      setCurrentStep((s) => s + 1);
                    }}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.roofType === o.value ? "border-[#E0592E] bg-[#FDEDE6]" : "border-[#E5E3DD] hover:border-[#E0592E]/50"
                    }`}
                  >
                    <p className="text-lg font-medium text-[#1A1D29]">{o.label}</p>
                  </button>
                ))}
              </div>
              {errors.roofType && (
                <div className="flex items-center mt-1 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.roofType}
                </div>
              )}
            </motion.div>
          )}

          {currentStep === 8 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <h3 className="text-[26px] md:text-3xl font-extrabold text-[#1A1D29] mb-6 text-center">Vos informations de contact</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#6B6F7B] mb-1">Prénom</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                        errors.firstName ? "border-red-500" : "border-[#E5E3DD]"
                      } focus:outline-none focus:ring-2 focus:ring-[#E0592E]`}
                      placeholder="Votre prénom"
                    />
                  </div>
                  {errors.firstName && <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#6B6F7B] mb-1">Nom</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                        errors.lastName ? "border-red-500" : "border-[#E5E3DD]"
                      } focus:outline-none focus:ring-2 focus:ring-[#E0592E]`}
                      placeholder="Votre nom"
                    />
                  </div>
                  {errors.lastName && <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#6B6F7B] mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                        errors.email ? "border-red-500" : "border-[#E5E3DD]"
                      } focus:outline-none focus:ring-2 focus:ring-[#E0592E]`}
                      placeholder="votre@email.com"
                    />
                  </div>
                  {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#6B6F7B] mb-1">Téléphone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                        errors.phone ? "border-red-500" : "border-[#E5E3DD]"
                      } focus:outline-none focus:ring-2 focus:ring-[#E0592E]`}
                      placeholder="Votre numéro"
                    />
                  </div>
                  {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#6B6F7B] mb-1">Message (optionnel)</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E3DD] focus:outline-none focus:ring-2 focus:ring-[#E0592E]"
                    rows={4}
                    placeholder="Vos questions ou commentaires..."
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        <div className="flex justify-between mt-8">
          {currentStep > 1 && (
            <button type="button" onClick={handlePrevious} className="flex items-center px-6 py-2 text-[#6B6F7B] hover:text-[#1A1D29] transition-colors">
              <ChevronLeft className="w-5 h-5 mr-2" />
              Précédent
            </button>
          )}

          <div className="ml-auto">
            <button
              type="button"
              onClick={handleNext}
              disabled={isSubmitting}
              className={`flex items-center px-7 py-3 rounded-lg text-white font-medium transition-colors ${
                isSubmitting ? "bg-black/60 cursor-not-allowed" : "bg-black hover:bg-[#1A1A1A]"
              }`}
            >
              {currentStep === 8 ? (
                isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Voir ma préconisation
                  </>
                )
              ) : (
                <>
                  Suivant
                  <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
