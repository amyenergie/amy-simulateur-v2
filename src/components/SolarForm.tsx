import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleMap, Marker, StandaloneSearchBox } from "@react-google-maps/api";
import {
  Home,
  Building2,
  ChevronRight,
  AlertCircle,
  Locate,
  User,
  Mail,
  Phone,
  Check,
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

const TOTAL_STEPS = 8;

const defaultCenter = { lat: 43.269827, lng: 5.395887 };

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

const BUILDING_OPTIONS: { value: FormData["buildingType"]; label: string }[] = [
  { value: "house", label: "Maison individuelle" },
  { value: "apartment", label: "Appartement" },
];

const SURFACE_OPTIONS: { value: FormData["surface"]; label: string }[] = [
  { value: "50", label: "Moins de 50 m²" },
  { value: "50-100", label: "50 à 100 m²" },
  { value: "100-150", label: "100 à 150 m²" },
  { value: "150+", label: "Plus de 150 m²" },
];

const HEATING_OPTIONS: { value: FormData["heatingType"]; label: string }[] = [
  { value: "electric", label: "Électricité" },
  { value: "gas", label: "Gaz" },
  { value: "fuel", label: "Fioul" },
  { value: "wood", label: "Bois" },
  { value: "other", label: "Autre" },
];

const ROOF_OPTIONS: { value: FormData["roofType"]; label: string }[] = [
  { value: "flat", label: "Toiture plate" },
  { value: "mono", label: "Mono-pente" },
  { value: "dual", label: "2 pans" },
  { value: "quad", label: "4 pans" },
  { value: "other", label: "Autre" },
];

const optBase =
  "border-[1.5px] rounded-[18px] p-5 cursor-pointer transition-all text-left flex flex-col gap-3";
const optOff = "border-white/15 bg-white/[0.06] hover:border-[#00b67a] hover:-translate-y-[3px] hover:bg-white/10";
const optOn = "border-[#00b67a] bg-[#00d38a]/15 shadow-[0_12px_28px_rgba(0,182,122,0.28)]";

const kickerClass =
  "inline-flex items-center gap-2 text-[13px] font-semibold text-[#bfffe4] bg-[#00d38a]/[0.14] border border-[#00d38a]/30 px-[15px] py-[7px] rounded-full mb-6";

const nextBtnClass =
  "border-none rounded-full px-9 py-[18px] text-[16px] font-bold cursor-pointer inline-flex items-center gap-2.5 transition-transform bg-gradient-to-br from-[#00b67a] to-[#00d38a] text-[#04241a] shadow-[0_16px_34px_rgba(0,182,122,0.4)] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0";

const secondaryBtnClass =
  "bg-white/[0.08] border-[1.5px] border-white/20 text-white rounded-full px-[26px] py-4 text-[14.5px] font-semibold cursor-pointer hover:bg-white/[0.14]";

export default function SolarForm() {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);

  const [formData, setFormData] = useState<FormData>({
    address: "",
    coordinates: null,
    buildingType: "",
    surface: "",
    residents: "3",
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
  const [mapType, setMapType] = useState<"satellite" | "roadmap">("satellite");
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [houseConfirmed, setHouseConfirmed] = useState(false);
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

  const annual = toNumber(pvgisData?.outputs?.totals?.fixed?.E_y);
  const specific = annual ? Math.round(annual / pvPeakpower) : null;
  const grade = gradeFromSpecific(specific);

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

  const resetLocationState = () => {
    setPvgisData(null);
    setPvgisError(null);
    setHouseConfirmed(false);
  };

  // Google Maps peut se retrouver avec un conteneur mesure a 0 au moment de
  // l'initialisation (montage dans une transition/anime, StrictMode, etc.).
  // On force un resize + un recentrage a chaque fois qu'on a une carte prete
  // et des coordonnees a afficher, pour garantir que les tuiles se chargent.
  // On force aussi explicitement le mapTypeId : la prop seule ne suffit pas
  // toujours a l'initialisation (la carte demarre parfois en "roadmap" malgre
  // mapTypeId="satellite").
  useEffect(() => {
    if (!mapInstance) return;
    const id = window.setTimeout(() => {
      window.google?.maps?.event?.trigger(mapInstance, "resize");
      mapInstance.setCenter(mapCenter);
      mapInstance.setZoom(19);
      mapInstance.setMapTypeId(mapType);
    }, 150);
    return () => window.clearTimeout(id);
  }, [mapInstance, mapCenter]);

  // Reagit explicitement aux clics sur les boutons Satellite / Plan, au cas ou
  // le composant GoogleMap ne repercute pas toujours le changement de prop.
  useEffect(() => {
    if (!mapInstance) return;
    mapInstance.setMapTypeId(mapType);
  }, [mapInstance, mapType]);

  const handleGeolocation = () => {
    if (!navigator.geolocation) return;

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        resetLocationState();

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

    resetLocationState();

    setMapCenter({ lat, lng });
    setFormData((prev) => ({
      ...prev,
      address: place.formatted_address || "",
      coordinates: { lat, lng },
    }));
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    resetLocationState();
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
  };

  const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    handleMapClick(e);
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

  const selectAndAdvance = (patch: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
    setTimeout(() => setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS)), 260);
  };

  const validateStep = () => {
    const newErrors: any = {};

    switch (currentStep) {
      case 1:
        if (!formData.address || !formData.coordinates) newErrors.address = "Sélectionnez une adresse valide";
        if (!houseConfirmed) newErrors.coordinates = "Confirmez votre maison sur la carte";
        break;
      case 2:
        if (!formData.buildingType) newErrors.buildingType = "Le type de bien est requis";
        break;
      case 3:
        if (!formData.surface) newErrors.surface = "La surface est requise";
        break;
      case 5:
        if (!formData.heatingType) newErrors.heatingType = "Le type de chauffage est requis";
        break;
      case 6:
        if (!formData.billValue || parseFloat(formData.billValue) <= 0) newErrors.billValue = "Le montant est requis";
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

  const contactValid = useMemo(() => {
    const first = formData.firstName.trim();
    const last = formData.lastName.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const phoneOk = phone.replace(/[^0-9]/g, "").length >= 10;
    return first.length > 1 && last.length > 1 && emailOk && phoneOk;
  }, [formData.firstName, formData.lastName, formData.email, formData.phone]);

  const handleNext = () => {
    if (!validateStep()) return;
    if (currentStep === TOTAL_STEPS) handleSubmit();
    else setCurrentStep((p) => p + 1);
  };

  const handlePrevious = () => setCurrentStep((p) => Math.max(1, p - 1));

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const hardTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout envoi (15s)")), 15000)
    );

    try {
      const techSummary = `Gisement ${grade.grade} | Spécifique ${specific ?? "—"} kWh/kWc/an | Hypothèses: ${pvPeakpower} kWc, pente ${pvAngle}°, azimut ${pvAspect}°, pertes ${pvLoss}%`;

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

  const billChips = useMemo(() => {
    const eurosMonthly = [60, 90, 120, 180, 250];
    const eurosAnnual = [720, 1080, 1440, 2160, 3000];
    const kwhMonthly = [200, 350, 500, 700, 1000];
    const kwhAnnual = [2500, 4200, 6000, 8400, 12000];
    if (formData.billUnit === "euros") return formData.billType === "monthly" ? eurosMonthly : eurosAnnual;
    return formData.billType === "monthly" ? kwhMonthly : kwhAnnual;
  }, [formData.billUnit, formData.billType]);

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

  const hue = (currentStep - 1) * 24;
  const progressPct = (currentStep / TOTAL_STEPS) * 100;

  return (
    <div
      className="relative min-h-[100dvh] w-full overflow-hidden text-white"
      style={{
        fontFamily: "'Lato', sans-serif",
        background: "linear-gradient(160deg, #0d1240 0%, #172162 38%, #0c3b4d 68%, #063a30 100%)",
      }}
    >
      {currentStep !== 1 && (
        <div
          className="absolute inset-0 pointer-events-none transition-[filter] duration-500"
          style={{ filter: `hue-rotate(${hue}deg)` }}
        >
          <motion.div
            className="absolute rounded-full blur-[70px] opacity-[0.55] w-[520px] h-[520px] bg-[#00d38a]"
            style={{ top: "-180px", right: "-140px" }}
            animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute rounded-full blur-[70px] opacity-[0.35] w-[420px] h-[420px] bg-[#ff8a3d]"
            style={{ bottom: "-160px", left: "-120px" }}
            animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute rounded-full blur-[70px] opacity-25 w-[300px] h-[300px] bg-[#3aa0ff] left-1/2 -translate-x-1/2"
            style={{ top: "40%" }}
            animate={{ y: [0, -40, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 h-1 bg-white/[0.14] z-[6]">
        <div
          className="h-full bg-gradient-to-r from-[#00b67a] to-[#00d38a] transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="absolute top-5 left-0 right-0 z-[6] flex items-center justify-between px-7">
        <div className="flex items-center gap-2 font-bold text-[14.5px] opacity-90" style={{ fontFamily: "'Poppins', sans-serif" }}>
          <span className="w-[26px] h-[26px] rounded-[7px] bg-gradient-to-br from-[#ff8a3d] via-[#ffc85c] to-[#3aa0ff] flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#0d1240" strokeWidth="2.4" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
            </svg>
          </span>
          AMY ENERGIE
        </div>
        <div className="text-xs text-[#cfe9ff] bg-white/[0.08] border border-white/[0.16] px-[13px] py-[6px] rounded-full backdrop-blur-sm">
          {currentStep} / {TOTAL_STEPS}
        </div>
      </div>

      {currentStep > 1 && (
        <button
          type="button"
          onClick={handlePrevious}
          className="absolute top-16 left-7 z-[6] w-[38px] h-[38px] rounded-full bg-white/10 border border-white/[0.18] text-white flex items-center justify-center text-xl backdrop-blur-sm hover:bg-white/20"
        >
          &#8249;
        </button>
      )}

      <div className="relative w-full h-[100dvh]">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="absolute inset-0">
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "100%" }}
                  center={mapCenter}
                  zoom={19}
                  mapTypeId={mapType}
                  options={{ disableDefaultUI: true, zoomControl: true, tilt: 0 }}
                  onClick={handleMapClick}
                  onLoad={(map) => {
                    setMapInstance(map);
                    map.setMapTypeId(mapType);
                    window.setTimeout(() => {
                      window.google?.maps?.event?.trigger(map, "resize");
                      map.setCenter(mapCenter);
                      map.setMapTypeId(mapType);
                    }, 150);
                  }}
                  onUnmount={() => setMapInstance(null)}
                >
                  {formData.coordinates && (
                    <Marker position={formData.coordinates} draggable onDragEnd={handleMarkerDragEnd} />
                  )}
                </GoogleMap>
              </div>

              <div
                className="absolute top-0 left-0 right-0 h-[280px] pointer-events-none z-[2]"
                style={{ background: "linear-gradient(180deg, rgba(9,14,50,.85), rgba(9,14,50,0))" }}
              />
              <div
                className="absolute bottom-0 left-0 right-0 h-[260px] pointer-events-none z-[2]"
                style={{ background: "linear-gradient(0deg, rgba(9,14,50,.88), rgba(9,14,50,0))" }}
              />

              <div className="absolute left-0 right-0 z-[4] flex flex-col items-center px-4 sm:px-8" style={{ top: "104px" }}>
                <div className={kickerClass}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  Localisation
                </div>
                <h1 className="text-[30px] font-semibold mb-[18px] text-center" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Où se situe votre toit ?
                </h1>
                <StandaloneSearchBox onLoad={onLoadSearchBox} onPlacesChanged={onPlacesChanged}>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={handleChange}
                    name="address"
                    placeholder="12 rue de la République"
                    className="w-full max-w-[540px] px-4 sm:px-6 py-[19px] rounded-2xl border-[1.5px] border-white/30 bg-[rgba(9,14,50,0.6)] backdrop-blur-md text-white text-[14.5px] sm:text-[16.5px] outline-none placeholder:text-white/50 focus:border-[#00b67a] focus:shadow-[0_0_0_4px_rgba(0,211,138,0.2)]"
                  />
                </StandaloneSearchBox>
                <div className="flex gap-2 mt-[14px]">
                  <button
                    type="button"
                    onClick={() => setMapType("satellite")}
                    className={`border-[1.5px] rounded-[9px] px-[15px] py-2 text-[12.5px] font-semibold backdrop-blur-sm ${
                      mapType === "satellite" ? "bg-[#00b67a] border-[#00b67a] text-[#04241a]" : "bg-[rgba(9,14,50,0.55)] border-white/25 text-[#dfe4ff]"
                    }`}
                  >
                    Satellite
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapType("roadmap")}
                    className={`border-[1.5px] rounded-[9px] px-[15px] py-2 text-[12.5px] font-semibold backdrop-blur-sm ${
                      mapType === "roadmap" ? "bg-[#00b67a] border-[#00b67a] text-[#04241a]" : "bg-[rgba(9,14,50,0.55)] border-white/25 text-[#dfe4ff]"
                    }`}
                  >
                    Plan
                  </button>
                  <button
                    type="button"
                    onClick={handleGeolocation}
                    disabled={isLocating}
                    title="Me géolocaliser"
                    className={`border-[1.5px] rounded-[9px] px-3 py-2 backdrop-blur-sm bg-[rgba(9,14,50,0.55)] border-white/25 text-white ${isLocating ? "opacity-60" : ""}`}
                  >
                    <Locate className={`w-4 h-4 ${isLocating ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="absolute bottom-9 left-0 right-0 z-[4] flex flex-col items-center px-4 sm:px-8 gap-3">
                {formData.coordinates && (
                  <div className="text-[13px] text-[#dfe4ff] bg-[rgba(9,14,50,0.55)] backdrop-blur-sm px-4 py-[9px] rounded-full text-center max-w-[540px]">
                    {pvgisLoading
                      ? "Calcul du gisement solaire en cours…"
                      : specific
                        ? `Ensoleillement estimé : ${specific.toLocaleString("fr-FR")} kWh/kWc/an · ${grade.label} (${grade.grade})`
                        : "Repère placé — confirmez votre maison"}
                  </div>
                )}

                {formData.coordinates && !houseConfirmed && (
                  <div className="flex gap-3 w-full max-w-[460px]">
                    <button
                      type="button"
                      onClick={() => setHouseConfirmed(true)}
                      className="flex-1 rounded-[14px] py-[15px] text-sm font-semibold border-[1.5px] border-[#00b67a] bg-[#00b67a] text-[#04241a]"
                    >
                      C'est bien ma maison
                    </button>
                    <button
                      type="button"
                      onClick={() => setHouseConfirmed(false)}
                      className="flex-1 rounded-[14px] py-[15px] text-sm font-semibold border-[1.5px] border-white/25 bg-[rgba(9,14,50,0.6)] backdrop-blur-sm text-white"
                    >
                      Ce n'est pas la bonne
                    </button>
                  </div>
                )}

                {houseConfirmed && (
                  <div className="flex items-center gap-2 text-[13.5px] font-bold text-[#04241a] bg-[#00d38a] px-[18px] py-[11px] rounded-full">
                    <Check className="w-4 h-4" />
                    Maison confirmée
                  </div>
                )}

                <button type="button" onClick={handleNext} disabled={!houseConfirmed} className={nextBtnClass}>
                  Continuer
                  <ChevronRight className="w-[17px] h-[17px]" />
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto px-4 sm:px-8"
              style={{ paddingTop: "110px", paddingBottom: "40px" }}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.4 }}
            >
              <div className="w-full max-w-[600px] text-center">
                <div className={kickerClass}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M3 10.5 12 3l9 7.5" />
                    <path d="M5 9.5V21h14V9.5" />
                  </svg>
                  Logement
                </div>
                <h1 className="text-[38px] font-semibold leading-tight mb-3.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  C'est quoi votre logement ?
                </h1>
                <p className="text-[#c3caf0] text-[15.5px] mb-[34px]">Ça change la façon dont on positionne les panneaux.</p>
                <div className="grid grid-cols-2 gap-3.5">
                  {BUILDING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => selectAndAdvance({ buildingType: opt.value })}
                      className={`${optBase} ${formData.buildingType === opt.value ? optOn : optOff}`}
                    >
                      <div className="w-[34px] h-[34px] rounded-[10px] bg-white/10 flex items-center justify-center">
                        {opt.value === "house" ? <Home className="w-[17px] h-[17px]" /> : <Building2 className="w-[17px] h-[17px]" />}
                      </div>
                      <div className="text-[15.5px] font-semibold">{opt.label}</div>
                    </button>
                  ))}
                </div>
                {errors.buildingType && (
                  <div className="flex items-center justify-center mt-4 text-red-300 text-sm">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.buildingType}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto px-4 sm:px-8"
              style={{ paddingTop: "110px", paddingBottom: "40px" }}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.4 }}
            >
              <div className="w-full max-w-[600px] text-center">
                <div className={kickerClass}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
                  </svg>
                  Surface
                </div>
                <h1 className="text-[38px] font-semibold leading-tight mb-3.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Quelle surface habitable ?
                </h1>
                <p className="text-[#c3caf0] text-[15.5px] mb-[34px]">Une estimation suffit.</p>
                <div className="grid grid-cols-2 gap-3.5">
                  {SURFACE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => selectAndAdvance({ surface: opt.value })}
                      className={`${optBase} ${formData.surface === opt.value ? optOn : optOff}`}
                    >
                      <div className="text-[15.5px] font-semibold">{opt.label}</div>
                    </button>
                  ))}
                </div>
                {errors.surface && (
                  <div className="flex items-center justify-center mt-4 text-red-300 text-sm">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.surface}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key="step4"
              className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto px-4 sm:px-8"
              style={{ paddingTop: "110px", paddingBottom: "40px" }}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.4 }}
            >
              <div className="w-full max-w-[600px] text-center">
                <div className={kickerClass}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <circle cx="9" cy="7" r="3.2" />
                    <path d="M2.5 21c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
                    <circle cx="17.5" cy="8.5" r="2.6" />
                    <path d="M15.7 14.8c2.7.4 4.8 2.7 4.8 5.5" />
                  </svg>
                  Foyer
                </div>
                <h1 className="text-[38px] font-semibold leading-tight mb-[30px]" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Combien d'habitants au quotidien ?
                </h1>
                <div className="mt-1.5">
                  <div
                    className="font-bold mb-2.5 text-[42px] bg-gradient-to-br from-white to-[#bfffe4] bg-clip-text text-transparent"
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    {formData.residents} personne{Number(formData.residents) > 1 ? "s" : ""}
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={formData.residents}
                    onChange={(e) => setFormData((p) => ({ ...p, residents: e.target.value }))}
                    className="w-full accent-[#00b67a] h-1.5"
                  />
                </div>
                <div className="mt-[34px] flex flex-col items-center gap-3.5">
                  <button type="button" onClick={handleNext} className={nextBtnClass}>
                    Continuer
                    <ChevronRight className="w-[17px] h-[17px]" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 5 && (
            <motion.div
              key="step5"
              className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto px-4 sm:px-8"
              style={{ paddingTop: "110px", paddingBottom: "40px" }}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.4 }}
            >
              <div className="w-full max-w-[600px] text-center">
                <div className={kickerClass}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
                  </svg>
                  Chauffage
                </div>
                <h1 className="text-[38px] font-semibold leading-tight mb-[30px]" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Vous chauffez comment ?
                </h1>
                <div className="grid grid-cols-2 gap-3.5">
                  {HEATING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => selectAndAdvance({ heatingType: opt.value })}
                      className={`${optBase} ${formData.heatingType === opt.value ? optOn : optOff}`}
                    >
                      <div className="text-[15.5px] font-semibold">{opt.label}</div>
                    </button>
                  ))}
                </div>
                {errors.heatingType && (
                  <div className="flex items-center justify-center mt-4 text-red-300 text-sm">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.heatingType}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {currentStep === 6 && (
            <motion.div
              key="step6"
              className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto px-4 sm:px-8"
              style={{ paddingTop: "110px", paddingBottom: "40px" }}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.4 }}
            >
              <div className="w-full max-w-[600px] text-center">
                <div className={kickerClass}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  Facture
                </div>
                <h1 className="text-[38px] font-semibold leading-tight mb-3.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Votre consommation d'électricité ?
                </h1>
                <p className="text-[#c3caf0] text-[15.5px] mb-[34px]">
                  En euros ou en kWh, comme vous préférez — indiqué sur votre facture.
                </p>

                <div className="flex bg-white/[0.08] border border-white/10 rounded-[13px] p-1 mb-4">
                  {(["euros", "kwh"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, billUnit: u }))}
                      className={`flex-1 rounded-[9px] py-[11px] text-[13.5px] font-semibold ${
                        formData.billUnit === u ? "bg-white/95 text-[#172162]" : "text-[#c3caf0]"
                      }`}
                    >
                      {u === "euros" ? "En euros €" : "En kWh"}
                    </button>
                  ))}
                </div>

                <div className="flex bg-white/[0.08] border border-white/10 rounded-[13px] p-1 mb-4">
                  {(["monthly", "annual"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, billType: p }))}
                      className={`flex-1 rounded-[9px] py-[11px] text-[13.5px] font-semibold ${
                        formData.billType === p ? "bg-white/95 text-[#172162]" : "text-[#c3caf0]"
                      }`}
                    >
                      {p === "monthly" ? "Facture mensuelle" : "Facture annuelle"}
                    </button>
                  ))}
                </div>

                <div className="text-left">
                  <label className="block text-center text-[13px] font-semibold text-[#c3caf0] mb-2.5">
                    {`Montant ${formData.billType === "monthly" ? "mensuel" : "annuel"} (${formData.billUnit === "euros" ? "€" : "kWh"})`}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.billValue}
                    onChange={(e) => setFormData((p) => ({ ...p, billValue: e.target.value.replace(/[^0-9.]/g, "") }))}
                    placeholder={formData.billUnit === "euros" ? (formData.billType === "monthly" ? "120" : "1440") : formData.billType === "monthly" ? "420" : "5000"}
                    className="w-full text-center px-5 py-5 rounded-2xl border-[1.5px] border-white/[0.18] bg-white/[0.07] text-white text-[26px] font-bold outline-none focus:border-[#00b67a] focus:shadow-[0_0_0_4px_rgba(0,211,138,0.16)]"
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  />
                </div>

                <div className="flex gap-2 mt-3.5 flex-wrap justify-center">
                  {billChips.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, billValue: String(c) }))}
                      className="border-[1.5px] border-white/[0.18] bg-white/[0.06] rounded-full px-4 py-2 text-[13px] font-semibold text-[#dfe4ff] hover:border-[#00b67a] hover:bg-[#00d38a]/[0.14]"
                    >
                      {c.toLocaleString("fr-FR")} {formData.billUnit === "euros" ? "€" : "kWh"}
                    </button>
                  ))}
                </div>

                {errors.billValue && (
                  <div className="flex items-center justify-center mt-4 text-red-300 text-sm">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.billValue}
                  </div>
                )}

                <div className="mt-[34px] flex flex-col items-center gap-3.5">
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!formData.billValue || parseFloat(formData.billValue) <= 0}
                    className={nextBtnClass}
                  >
                    Continuer
                    <ChevronRight className="w-[17px] h-[17px]" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 7 && (
            <motion.div
              key="step7"
              className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto px-4 sm:px-8"
              style={{ paddingTop: "110px", paddingBottom: "40px" }}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.4 }}
            >
              <div className="w-full max-w-[600px] text-center">
                <div className={kickerClass}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M3 10.5 12 3l9 7.5M6 10v3M18 10v3" />
                  </svg>
                  Toiture
                </div>
                <h1 className="text-[38px] font-semibold leading-tight mb-[30px]" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Et votre toiture, elle ressemble à quoi ?
                </h1>
                <div className="grid grid-cols-2 gap-3.5">
                  {ROOF_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => selectAndAdvance({ roofType: opt.value })}
                      className={`${optBase} ${formData.roofType === opt.value ? optOn : optOff}`}
                    >
                      <div className="text-[15.5px] font-semibold">{opt.label}</div>
                    </button>
                  ))}
                </div>
                {errors.roofType && (
                  <div className="flex items-center justify-center mt-4 text-red-300 text-sm">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.roofType}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {currentStep === 8 && (
            <motion.div
              key="step8"
              className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto px-4 sm:px-8"
              style={{ paddingTop: "110px", paddingBottom: "40px" }}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.4 }}
            >
              <div className="w-full max-w-[600px] text-center">
                <div className={kickerClass}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M4 4h16v16H4z" />
                    <path d="M4 9h16M9 4v16" />
                  </svg>
                  Dernière étape
                </div>
                <h1 className="text-[38px] font-semibold leading-tight mb-3.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Où vous envoyer votre étude ?
                </h1>
                <p className="text-[#c3caf0] text-[15.5px] mb-[34px]">Un conseiller vous rappelle sous 24h ouvrées.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-left">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#c3caf0] mb-2.5">Prénom *</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/40" />
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        placeholder="Camille"
                        className="w-full pl-11 pr-4 py-[15px] rounded-2xl border-[1.5px] border-white/[0.18] bg-white/[0.07] text-white text-[15px] outline-none focus:border-[#00b67a] focus:shadow-[0_0_0_4px_rgba(0,211,138,0.16)] placeholder:text-white/40"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#c3caf0] mb-2.5">Nom *</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/40" />
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        placeholder="Martin"
                        className="w-full pl-11 pr-4 py-[15px] rounded-2xl border-[1.5px] border-white/[0.18] bg-white/[0.07] text-white text-[15px] outline-none focus:border-[#00b67a] focus:shadow-[0_0_0_4px_rgba(0,211,138,0.16)] placeholder:text-white/40"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 text-left">
                  <label className="block text-[13px] font-semibold text-[#c3caf0] mb-2.5">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/40" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="camille@email.com"
                      className="w-full pl-11 pr-4 py-[15px] rounded-2xl border-[1.5px] border-white/[0.18] bg-white/[0.07] text-white text-[15px] outline-none focus:border-[#00b67a] focus:shadow-[0_0_0_4px_rgba(0,211,138,0.16)] placeholder:text-white/40"
                    />
                  </div>
                </div>

                <div className="mt-3.5 text-left">
                  <label className="block text-[13px] font-semibold text-[#c3caf0] mb-2.5">Téléphone *</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/40" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="06 12 34 56 78"
                      className="w-full pl-11 pr-4 py-[15px] rounded-2xl border-[1.5px] border-white/[0.18] bg-white/[0.07] text-white text-[15px] outline-none focus:border-[#00b67a] focus:shadow-[0_0_0_4px_rgba(0,211,138,0.16)] placeholder:text-white/40"
                    />
                  </div>
                </div>

                <p className="text-[12.5px] text-[#a9b3e0] mt-3.5 text-center">
                  Ces informations nous permettent de vous envoyer votre préconisation personnalisée.
                </p>

                <div className="mt-[34px] flex flex-col items-center gap-3.5">
                  <button type="button" onClick={handleNext} disabled={isSubmitting || !contactValid} className={nextBtnClass}>
                    {isSubmitting ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#04241a]" />
                    ) : (
                      <>
                        Voir ma préconisation
                        <ChevronRight className="w-[17px] h-[17px]" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
