import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Download, Loader2 } from "lucide-react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const FUNCTIONS_BASE = import.meta.env.PROD ? "" : "https://amyenergie.netlify.app";

function toNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatInt(n: number | null) {
  if (n === null) return "—";
  return Math.round(n).toLocaleString("fr-FR");
}

function formatEuro(n: number | null) {
  if (n === null) return "—";
  return Math.round(n).toLocaleString("fr-FR") + " €";
}

function gradeFromSpecific(s: number | null) {
  if (!s) return { grade: "—", label: "Données indisponibles" };
  if (s >= 1500) return { grade: "A", label: "Excellent gisement" };
  if (s >= 1350) return { grade: "B", label: "Très bon gisement" };
  if (s >= 1200) return { grade: "C", label: "Bon gisement" };
  return { grade: "D", label: "Gisement correct" };
}

function badgeClasses(grade: string) {
  if (grade === "A") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (grade === "B") return "bg-green-100 text-green-900 border-green-200";
  if (grade === "C") return "bg-yellow-100 text-yellow-900 border-yellow-200";
  if (grade === "D") return "bg-orange-100 text-orange-900 border-orange-200";
  return "bg-gray-100 text-gray-800 border-gray-200";
}

function roofTypeLabel(rt: string) {
  if (rt === "flat") return "Toiture plate";
  if (rt === "mono") return "Mono-pente";
  if (rt === "dual") return "Deux pans";
  if (rt === "quad") return "Quatre pans";
  if (rt) return "Autre";
  return "—";
}

function safeText(v: any) {
  return String(v ?? "");
}

function fmtIntPdf(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function ResultsPage() {
  const nav = useNavigate();
  const location = useLocation() as any;

  const state = (() => {
    if (location.state) return location.state;
    try {
      const raw = sessionStorage.getItem("amy_results");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })();

  const powerRecommendation = state.powerRecommendation as number | null;
  const priceRange = state.priceRange as { min: number; max: number } | null;
  const monthlyBill = state.monthlyBill as number | null;
  const formData = state.formData || {};
  const pvgisFromState = state.pvgis || null;
  const pvgisParams = state.pvgisParams || { pvPeakpower: 6, pvAngle: 35, pvAspect: 0, pvLoss: 14 };
  const techSummaryFromState = (state.techSummary as string) || "";

  const coords = formData?.coordinates || null;
  const lat = toNumber(coords?.lat);
  const lng = toNumber(coords?.lng);

  const [pvgis, setPvgis] = useState<any>(pvgisFromState);
  const [pvgisLoading, setPvgisLoading] = useState(false);
  const [pvgisError, setPvgisError] = useState<string | null>(null);

  const [pdfStatus, setPdfStatus] = useState<"idle" | "generating" | "error">("idle");

  useEffect(() => {
    if (pvgis) return;
    if (!lat || !lng) return;

    let cancelled = false;

    async function run() {
      setPvgisLoading(true);
      setPvgisError(null);

      try {
        const qs = new URLSearchParams({
          lat: String(lat),
          lon: String(lng),
          peakpower: String(pvgisParams.pvPeakpower ?? 6),
          angle: String(pvgisParams.pvAngle ?? 35),
          aspect: String(pvgisParams.pvAspect ?? 0),
          loss: String(pvgisParams.pvLoss ?? 14),
        });

        const r = await fetch(`${FUNCTIONS_BASE}/.netlify/functions/irradiation?${qs.toString()}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Erreur PVGIS");
        if (!cancelled) setPvgis(j);
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
  }, [pvgis, lat, lng, pvgisParams]);

  const annualRef = toNumber(pvgis?.outputs?.totals?.fixed?.E_y);

  const specific = useMemo(() => {
    const peak = Number(pvgisParams?.pvPeakpower || 6);
    if (!annualRef || !peak) return null;
    return Math.round(annualRef / peak);
  }, [annualRef, pvgisParams]);

  const grade = gradeFromSpecific(specific);

  const annualProdForReco = useMemo(() => {
    if (!specific || !powerRecommendation) return null;
    return Math.round(specific * powerRecommendation);
  }, [specific, powerRecommendation]);

  const annualBillEuro = useMemo(() => {
    if (!monthlyBill || !Number.isFinite(monthlyBill)) return null;
    return Math.round(monthlyBill * 12);
  }, [monthlyBill]);

  const amortRapide = useMemo(() => {
    if (!priceRange?.min || !annualBillEuro || annualBillEuro <= 0) return null;
    return priceRange.min / annualBillEuro;
  }, [priceRange, annualBillEuro]);

  const panelsCount = useMemo(() => {
    if (!powerRecommendation) return null;
    return Math.round((powerRecommendation * 1000) / 500);
  }, [powerRecommendation]);

  const prodValoriseeVirtuelle = useMemo(() => {
    if (!annualProdForReco) return null;
    return Math.round(annualProdForReco * 1.0);
  }, [annualProdForReco]);

  const techLine =
    techSummaryFromState ||
    `Gisement ${grade.grade} | Spécifique ${specific ?? "—"} kWh/kWc/an | Production estimée ${annualProdForReco ?? "—"} kWh/an`;

  // Genere une proposition commerciale PDF entierement construite en code
  // (logo + textes + stats), sans dependre de fichiers externes fragiles.
  async function downloadProposalPdf() {
    if (pdfStatus === "generating") return;
    if (!powerRecommendation || !priceRange) return;
    setPdfStatus("generating");

    try {
      const PRIX_KWH_BASE = 0.28;
      const production = prodValoriseeVirtuelle || annualProdForReco || 0;

      let economies30 = 0;
      for (let year = 0; year < 30; year++) {
        economies30 += production * (PRIX_KWH_BASE * Math.pow(1.03, year));
      }

      const logoBytes = await fetch("/logos/amy.png").then((r) => r.arrayBuffer());

      const PAGE_W = 595.28;
      const PAGE_H = 841.89;
      const MARGIN = 48;
      const NAVY = rgb(23 / 255, 33 / 255, 98 / 255);
      const CORAL = rgb(224 / 255, 89 / 255, 46 / 255);
      const GRAY = rgb(90 / 255, 95 / 255, 138 / 255);
      const WHITE = rgb(1, 1, 1);
      const DARK = rgb(0.2, 0.2, 0.25);

      const pdfDoc = await PDFDocument.create();
      const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logoImage = await pdfDoc.embedPng(logoBytes);

      const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

      const firstName = safeText(formData?.firstName) || "Prenom";
      const lastName = safeText(formData?.lastName) || "Nom";
      const address = safeText(formData?.address) || "Adresse non renseignee";

      page.drawRectangle({ x: 0, y: PAGE_H - 170, width: PAGE_W, height: 170, color: NAVY });

      const logoW = 110;
      const logoH = (110 * 138) / 349;
      page.drawImage(logoImage, { x: MARGIN, y: PAGE_H - 55 - logoH, width: logoW, height: logoH });

      page.drawText("PROPOSITION PHOTOVOLTAIQUE", {
        x: MARGIN,
        y: PAGE_H - 100,
        size: 10,
        font: helvBold,
        color: rgb(0.75, 0.85, 1),
      });
      page.drawText(`${firstName} ${lastName}`, {
        x: MARGIN,
        y: PAGE_H - 125,
        size: 20,
        font: helvBold,
        color: WHITE,
      });
      page.drawText(address, { x: MARGIN, y: PAGE_H - 148, size: 11, font: helv, color: rgb(0.85, 0.88, 1) });

      let y = PAGE_H - 220;
      const boxH = 78;
      const boxGap = 12;
      const boxW = (PAGE_W - 2 * MARGIN - 2 * boxGap) / 3;

      function statBox(x: number, label: string, value: string, sub: string, coral?: boolean) {
        page.drawRectangle({ x, y, width: boxW, height: boxH, color: coral ? CORAL : rgb(0.96, 0.96, 0.98) });
        page.drawText(label, { x: x + 12, y: y + boxH - 20, size: 7.5, font: helv, color: coral ? WHITE : GRAY });
        page.drawText(value, { x: x + 12, y: y + boxH - 45, size: 16, font: helvBold, color: coral ? WHITE : NAVY });
        page.drawText(sub, { x: x + 12, y: y + 12, size: 7.5, font: helv, color: coral ? rgb(1, 0.9, 0.85) : GRAY });
      }

      statBox(MARGIN, "PUISSANCE INSTALLEE", `${powerRecommendation.toFixed(2)} kWc`, `${panelsCount ?? "—"} panneaux estimes`);
      statBox(MARGIN + boxW + boxGap, "PRODUCTION ANNUELLE", `${fmtIntPdf(production)} kWh`, "chaque annee");
      statBox(MARGIN + 2 * (boxW + boxGap), "ECONOMIES ESTIMEES", `${fmtIntPdf(economies30)} €`, "sur 30 ans", true);

      y -= 46;
      page.drawText("Votre potentiel solaire", { x: MARGIN, y, size: 14, font: helvBold, color: NAVY });
      y -= 24;

      const bodyLines = [
        `Gisement solaire estime : ${grade.label} (${grade.grade}).`,
        `Production specifique : ${specific ? fmtIntPdf(specific) + " kWh/kWc/an" : "—"}.`,
        `Facture annuelle actuelle : ${annualBillEuro ? fmtIntPdf(annualBillEuro) + " €" : "—"}.`,
        `Amortissement estime : ${amortRapide ? amortRapide.toFixed(1) + " ans" : "—"}.`,
      ];
      bodyLines.forEach((line) => {
        page.drawText(line, { x: MARGIN, y, size: 11, font: helv, color: DARK });
        y -= 18;
      });

      y -= 22;
      page.drawText("Prochaines etapes", { x: MARGIN, y, size: 14, font: helvBold, color: NAVY });
      y -= 24;

      const steps = [
        "1. Etude technique complete offerte par un conseiller AMY Energie.",
        "2. Visite terrain et validation de la configuration finale.",
        "3. Demarches administratives prises en charge (mairie, Consuel, raccordement).",
        "4. Installation et mise en service.",
      ];
      steps.forEach((line) => {
        page.drawText(line, { x: MARGIN, y, size: 11, font: helv, color: DARK });
        y -= 18;
      });

      page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 46, color: NAVY });
      page.drawText("AMY ENERGIE  -  contact@amy-energie.fr  -  amy-energie.fr", {
        x: MARGIN,
        y: 18,
        size: 9,
        font: helv,
        color: WHITE,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const safeName = `${firstName}_${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposition_commerciale_${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPdfStatus("idle");
    } catch (e) {
      console.error("PDF generation error:", e);
      setPdfStatus("error");
    }
  }

  if (!powerRecommendation || !priceRange) {
    return (
      <div className="min-h-screen bg-[#f6f4f1] p-6 flex items-center justify-center">
        <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl p-8 border border-black/10">
          <div className="text-2xl text-[#0b2b6f]">Résultat indisponible</div>
          <div className="text-sm text-gray-600 mt-2">Relance une simulation.</div>
          <button
            onClick={() => nav("/")}
            className="mt-6 px-6 py-2 rounded-xl bg-[#0b2b6f] text-white hover:opacity-90 transition"
          >
            Revenir au simulateur
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f4f1]">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="rounded-3xl overflow-hidden shadow-2xl border border-black/10 bg-white">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff7a00] via-[#ffc400] to-[#2b7cff] opacity-16" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,122,0,0.14),transparent_35%),radial-gradient(circle_at_80%_15%,rgba(43,124,255,0.12),transparent_45%)]" />
            <div className="relative p-8">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[#0b2b6f] text-3xl md:text-4xl">Bilan de votre projet solaire</div>
                  <div className="text-gray-700 text-sm mt-2 break-words">
                    Adresse : {safeText(formData?.address) || "—"}
                  </div>
                  <div className="text-gray-600 text-sm mt-1 break-words">
                    Type : {formData?.buildingType === "house" ? "Maison" : formData?.buildingType === "apartment" ? "Appartement" : "—"} ·
                    Toiture : {roofTypeLabel(formData?.roofType)} ·
                    Occupants : {safeText(formData?.residents) || "—"}
                  </div>

                  <div className="text-gray-700 text-sm mt-3 break-words">
                    {pvgisLoading ? "Calcul PVGIS en cours…" : pvgisError ? `PVGIS indisponible: ${pvgisError}` : techLine}
                  </div>
                </div>

                <div className={`inline-flex items-center rounded-full border px-3 py-1 text-sm ${badgeClasses(grade.grade)}`}>
                  Potentiel solaire : {grade.label} ({grade.grade})
                </div>
              </div>

              <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white border border-black/10 p-5 shadow-sm">
                  <div className="text-gray-600 text-sm">Puissance conseillée</div>
                  <div className="text-[#0b2b6f] text-3xl mt-1">{powerRecommendation} kWc</div>
                  <div className="text-gray-600 text-xs mt-2">
                    {panelsCount ? `${panelsCount} panneaux de 500 Wc` : "Panneaux 500 Wc"}
                  </div>
                </div>

                <div className="rounded-2xl bg-white border border-black/10 p-5 shadow-sm">
                  <div className="text-gray-600 text-sm">Production estimée</div>
                  <div className="text-[#0b2b6f] text-3xl mt-1">{formatInt(annualProdForReco)} kWh/an</div>
                  <div className="text-gray-500 text-xs mt-2">
                    Spécifique : {specific ? `${formatInt(specific)} kWh/kWc/an` : "—"}
                  </div>
                </div>

                <div className="rounded-2xl bg-white border border-black/10 p-5 shadow-sm">
                  <div className="text-gray-600 text-sm">Amortissement rapide</div>
                  <div className="text-[#0b2b6f] text-3xl mt-1">{amortRapide ? `${amortRapide.toFixed(1)} ans` : "—"}</div>
                  <div className="text-gray-500 text-xs mt-2">
                    Coût min / facture annuelle ({formatEuro(annualBillEuro)})
                  </div>
                </div>
              </div>

              <div className="mt-6 text-gray-700 text-sm">
                Verdict : profil idéal pour une installation photovoltaïque. Validation finale par étude technique complète offerte.
              </div>

              <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={downloadProposalPdf}
                  disabled={pdfStatus === "generating"}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-white transition ${
                    pdfStatus === "generating" ? "bg-black/60 cursor-wait" : "bg-black hover:bg-[#1A1A1A]"
                  }`}
                >
                  {pdfStatus === "generating" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Télécharger ma proposition (PDF)
                </button>
                {pdfStatus === "error" && (
                  <span className="text-red-600 text-xs">Échec de la génération, réessayez.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => nav("/")}
          className="w-full rounded-2xl px-6 py-3 bg-gray-100 text-gray-800 hover:bg-gray-200 transition border border-black/10"
        >
          Refaire une simulation
        </button>
      </div>
    </div>
  );
}
