import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Props = {
  address?: string;
  onDone: () => void;
};

export default function PreconisationLoader({ address, onDone }: Props) {
  const steps = [
    { title: "Analyse PVGIS", subtitle: "Calcul du gisement solaire local…" },
    { title: "Dimensionnement", subtitle: "Estimation de la puissance conseillée…" },
    { title: "Optimisation AUTOCONSO", subtitle: "Simulation des scénarios batterie…" },
    { title: "Verdict", subtitle: "Profil idéal pour une installation photovoltaïque." },
  ];

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timings = [650, 650, 650, 550]; // total ~2.5s
    let t: any;

    const run = (i: number) => {
      if (i >= steps.length - 1) {
        t = setTimeout(() => onDone(), timings[i] || 500);
        return;
      }
      t = setTimeout(() => {
        setIdx((x) => Math.min(x + 1, steps.length - 1));
        run(i + 1);
      }, timings[i] || 600);
    };

    run(0);
    return () => {
      if (t) clearTimeout(t);
    };
  }, [onDone]);

  const progress = ((idx + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f4f1] p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-black/10 bg-white shadow-2xl overflow-hidden">
        <div className="relative p-7">
          <div className="absolute inset-0 bg-gradient-to-br from-[#ff7a00] via-[#ffc400] to-[#2b7cff] opacity-18" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,122,0,0.14),transparent_35%),radial-gradient(circle_at_80%_15%,rgba(43,124,255,0.12),transparent_45%)]" />

          <div className="relative">
            <div className="text-[#0b2b6f] text-3xl">Diagnostic en cours</div>
            <div className="text-gray-600 text-sm mt-2">
              {address ? `Adresse : ${address}` : "Analyse de votre projet…"}
            </div>

            <div className="mt-5 h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#00B67A] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-6 space-y-3">
              {steps.map((s, i) => {
                const active = i === idx;
                const done = i < idx;

                return (
                  <div
                    key={s.title}
                    className={`rounded-2xl border p-4 transition ${
                      active
                        ? "border-[#00B67A] bg-[#00B67A]/10"
                        : done
                          ? "border-black/10 bg-gray-50"
                          : "border-black/10 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[#0b2b6f] text-lg">{s.title}</div>
                        <div className="text-gray-600 text-sm mt-1">{s.subtitle}</div>
                      </div>

                      <div className="shrink-0">
                        {done ? (
                          <div className="text-emerald-700 text-sm">OK</div>
                        ) : active ? (
                          <div className="text-[#0b2b6f] text-sm">…</div>
                        ) : (
                          <div className="text-gray-400 text-sm">—</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <motion.div
              className="mt-6 rounded-3xl border border-black/10 bg-white p-5 shadow-sm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="text-[#0b2b6f] text-xl">Verdict</div>
              <div className="text-gray-700 text-sm mt-2">
                Profil idéal pour une installation photovoltaïque.
              </div>
              <div className="text-gray-500 text-xs mt-2">
                La préconisation finale arrive juste après.
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
