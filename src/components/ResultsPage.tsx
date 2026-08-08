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

  const panelsCount = useMemo(() => {
    if (!powerRecommendation) return null;
    return Math.round((powerRecommendation * 1000) / 500);
  }, [powerRecommendation]);

  const prodValoriseeVirtuelle = useMemo(() => {
    if (!annualProdForReco) return null;
    return Math.round(annualProdForReco * 1.0);
  }, [annualProdForReco]);

  // Cout d'installation retenu pour l'amortissement (moyenne de la fourchette,
  // pour rester representatif plutot que de prendre uniquement le minimum).
  const estimatedInstallCost = useMemo(() => {
    if (!priceRange) return null;
    return Math.round((priceRange.min + priceRange.max) / 2);
  }, [priceRange]);

  // Economies annuelles estimees a partir de la production reellement valorisee
  // (kWh produits x prix du kWh), plafonnees par la facture actuelle car on ne
  // peut pas economiser plus que ce que l'on depense aujourd'hui.
  const annualSavingsEuro = useMemo(() => {
    const production = prodValoriseeVirtuelle || annualProdForReco;
    if (!production) return null;
    const PRIX_KWH_BASE = 0.28;
    const solarSavings = production * PRIX_KWH_BASE;
    if (annualBillEuro && annualBillEuro > 0) return Math.min(solarSavings, annualBillEuro);
    return solarSavings;
  }, [prodValoriseeVirtuelle, annualProdForReco, annualBillEuro]);

  const amortRapide = useMemo(() => {
    if (!estimatedInstallCost || !annualSavingsEuro || annualSavingsEuro <= 0) return null;
    return estimatedInstallCost / annualSavingsEuro;
  }, [estimatedInstallCost, annualSavingsEuro]);

  const techLine =
    techSummaryFromState ||
    `Gisement ${grade.grade} | Spécifique ${specific ?? "—"} kWh/kWc/an | Production estimée ${annualProdForReco ?? "—"} kWh/an`;

  // Genere la proposition commerciale PDF (page 1 personnalisee + pages 2-8
  // officielles) a partir des donnees deja calculees sur cette page.
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

      const [heroBytes, logoBytes, staticBytes] = await Promise.all([
        fetch("/logos/pdf-hero.jpg").then((r) => r.arrayBuffer()),
        fetch("/logos/amy.png").then((r) => r.arrayBuffer()),
        fetch("/logos/pdf-static-pages.pdf").then((r) => r.arrayBuffer()),
      ]);

      const PAGE_W = 841.92;
      const PAGE_H = 594.96;
      const MARGIN = 34;
      const NAVY = rgb(23 / 255, 33 / 255, 98 / 255);
      const CORAL = rgb(224 / 255, 89 / 255, 46 / 255);
      const WHITE = rgb(1, 1, 1);
      const BLACK = rgb(0, 0, 0);

      const pdfDoc = await PDFDocument.create();
      const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const heroImage = await pdfDoc.embedJpg(heroBytes);
      const logoImage = await pdfDoc.embedPng(logoBytes);

      const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

      const firstName = safeText(formData?.firstName) || "Prenom";
      const lastName = safeText(formData?.lastName) || "Nom";
      const address = safeText(formData?.address) || "Adresse non renseignee";

      page.drawImage(heroImage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

      const logoW = 118;
      const logoH = (118 * 138) / 349;
      page.drawImage(logoImage, { x: MARGIN, y: PAGE_H - MARGIN - logoH, width: logoW, height: logoH });

      const topLabel = "PROPOSITION PHOTOVOLTAIQUE";
      const topLabelW = helvBold.widthOfTextAtSize(topLabel, 9);
      page.drawText(topLabel, { x: PAGE_W - MARGIN - topLabelW, y: PAGE_H - MARGIN - 8, size: 9, font: helvBold, color: WHITE });

      const preparedY = PAGE_H * 0.62;
      const addrLine = `${firstName} ${lastName} — ${address}`;
      const headline1 = "Decouvrez votre projet";
      const headline2 = "photovoltaique";

      const wAddr = helv.widthOfTextAtSize(addrLine, 15);
      const wH1 = helvBold.widthOfTextAtSize(headline1, 30);
      const wH2 = helvBold.widthOfTextAtSize(headline2, 30);
      const blockW = Math.max(wAddr, wH1, wH2) + 34;

      page.drawRectangle({ x: MARGIN - 12, y: preparedY - 96, width: blockW, height: 128, color: BLACK, opacity: 0.3 });

      page.drawText("PREPARE POUR", { x: MARGIN, y: preparedY + 26, size: 9, font: helvBold, color: WHITE });
      page.drawText(addrLine, { x: MARGIN, y: preparedY, size: 15, font: helv, color: WHITE });
      page.drawText(headline1, { x: MARGIN, y: preparedY - 45, size: 30, font: helvBold, color: WHITE });
      page.drawText(headline2, { x: MARGIN, y: preparedY - 80, size: 30, font: helvBold, color: WHITE });

      const boxY = 28;
      const boxH = 118;
      const boxGap = 14;
      const boxW = (PAGE_W - 2 * MARGIN - 2 * boxGap) / 3;
      const x1 = MARGIN;
      const x2 = x1 + boxW + boxGap;
      const x3 = x2 + boxW + boxGap;

      function statBox(x: number, label: string, value: string, sub: string, coral?: boolean) {
        page.drawRectangle({ x, y: boxY, width: boxW, height: boxH, color: coral ? CORAL : WHITE, opacity: coral ? 0.92 : 0.82 });
        const labelColor = coral ? WHITE : rgb(90 / 255, 95 / 255, 138 / 255);
        const valueColor = coral ? WHITE : NAVY;
        const subColor = coral ? rgb(250 / 255, 235 / 255, 227 / 255) : rgb(90 / 255, 95 / 255, 138 / 255);
        page.drawText(label, { x: x + 18, y: boxY + boxH - 26, size: 9, font: helv, color: labelColor });
        page.drawText(value, { x: x + 18, y: boxY + boxH - 60, size: 26, font: helvBold, color: valueColor });
        page.drawText(sub, { x: x + 18, y: boxY + 16, size: 9, font: helv, color: subColor });
      }

      statBox(x1, "PUISSANCE INSTALLEE", `${powerRecommendation.toFixed(2)} kWc`, `${panelsCount ?? "—"} panneaux estimes`);
      statBox(x2, "PRODUCTION ANNUELLE", `${fmtIntPdf(production)} kWh`, "Sur votre toiture, chaque annee");
      statBox(x3, "ECONOMIES TOTALES", `${fmtIntPdf(economies30)} €`, "sur 30 ans", true);

      const staticDoc = await PDFDocument.load(staticBytes);
      const copiedPages = await pdfDoc.copyPages(staticDoc, staticDoc.getPageIndices());
      copiedPages.forEach((p) => pdfDoc.addPage(p));

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
                  <div className="text-gray-600 text-sm">Amortissement estimé</div>
                  <div className="text-[#0b2b6f] text-3xl mt-1">{amortRapide ? `${amortRapide.toFixed(1)} ans` : "—"}</div>
                  <div className="text-gray-500 text-xs mt-2">
                    Investissement ~{formatEuro(estimatedInstallCost)} · Économies ~{formatEuro(annualSavingsEuro)}/an
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
