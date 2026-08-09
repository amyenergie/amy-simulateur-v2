// src/lib/analytics.ts
//
// Suivi des conversions Google Ads pour le simulateur solaire (amyenergie.netlify.app).
//
// A CONFIGURER avant deploiement :
// 1. Dans Google Ads > Objectifs > Resume > "+ Creer un objectif" > "Prospect" (Leads)
//    > Action de conversion "Site Web" > donne-lui un nom du type "Devis solaire complete".
// 2. Une fois creee, ouvre l'action > "Configuration de la balise" > "Installer moi-meme"
//    Tu y trouveras un ID du type AW-123456789 et un label du type AbC-D_efGHIjkLMN012.
// 3. Colle ces deux valeurs ci-dessous, a la place des placeholders.

export const GOOGLE_ADS_CONVERSION_ID = "AW-16522842801";
export const GOOGLE_ADS_CONVERSION_LABEL = "vWFzCKahv94cELGl2sY9";

// Domaine du site principal, pour le cross-domain tracking (permet a Google Ads de
// relier une conversion faite ici a un clic pub qui a atterri sur amy-energie.fr).
const LINKED_DOMAINS = ["amy-energie.fr", "amyenergie.netlify.app"];

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

let initialized = false;

/**
 * Charge gtag.js et initialise le tag Google Ads sur cette page.
 * A appeler une seule fois, au demarrage de l'app (voir main.tsx).
 */
export function initGoogleAdsTag(): void {
  if (initialized || typeof window === "undefined") return;
  if (GOOGLE_ADS_CONVERSION_ID.includes("XXXXXXXXX")) {
    console.warn(
      "[analytics] GOOGLE_ADS_CONVERSION_ID non configure -- le tracking de conversion est desactive. Voir src/lib/analytics.ts"
    );
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_CONVERSION_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };

  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ADS_CONVERSION_ID, {
    linker: { domains: LINKED_DOMAINS },
  });

  initialized = true;
}

/**
 * Declenche la conversion Google Ads "Devis solaire complete".
 * A appeler juste apres l'envoi reussi du lead (voir SolarForm.tsx handleSubmit).
 */
export function trackQuoteConversion(): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (GOOGLE_ADS_CONVERSION_LABEL.includes("XXXXXXXXXXXX")) return;

  window.gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_CONVERSION_ID}/${GOOGLE_ADS_CONVERSION_LABEL}`,
  });
}
