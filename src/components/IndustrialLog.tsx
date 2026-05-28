"use client";

import React, { useEffect, useState, useRef } from "react";
import { subscribeToLogs } from "@/services/travelService";
import { isFirebaseConfigured } from "@/services/firebase";

export default function IndustrialLog() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isBlinking, setIsBlinking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Carrega logs iniciais
    setLogs([
      `[SYSTEM] BOOT INITIALIZED...`,
      `[SYSTEM] PROTOCOL: ${isFirebaseConfigured ? "REAL_FIRESTORE_DB" : "LOCAL_SIMULATION_DB"}`,
      `[SYSTEM] PERSISTENCE ENGINE READY.`,
    ]);

    // Subscrever a eventos de serviço
    const unsubscribe = subscribeToLogs((newLog) => {
      setLogs((prev) => [...prev, newLog]);
      setIsBlinking(true);
      const timer = setTimeout(() => setIsBlinking(false), 300);
      return () => clearTimeout(timer);
    });

    return () => unsubscribe();
  }, []);

  // Rolagem automática para o rodapé
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const clearLogs = () => {
    setLogs([`[SYSTEM] CONSOLE CLEARED. PERSISTENCE ENGINE ACTIVE.`]);
  };

  return (
    <div className="w-full glass-panel shadow-2xl text-slate-300 font-mono-tech text-xs overflow-hidden rounded-2xl border border-slate-800/80 shadow-lg select-none">
      {/* Cabeçalho do Terminal */}
      <div className="bg-slate-950/40 border-b border-slate-800/80 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          {/* LED de Conexão */}
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isFirebaseConfigured
                ? "bg-[#10b981] led-green"
                : "bg-[#f59e0b] led-amber animate-pulse"
            } ${isBlinking ? "opacity-30" : ""}`}
            title={isFirebaseConfigured ? "Firestore Conectado" : "Modo Simulação Local Ativo"}
          />
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-sans">
            CONSOLE TRANSACIONAL DE OPERAÇÕES
          </span>
        </div>
        <div className="flex items-center space-x-3.5">
          <span className="text-[9.5px] text-slate-500 font-sans font-semibold">
            DB_ENGINE: <span className={isFirebaseConfigured ? "text-[#10b981]" : "text-[#f59e0b]"}>
              {isFirebaseConfigured ? "FIRESTORE_V12" : "LOCAL_MOCK_STORAGE"}
            </span>
          </span>
          <button
            onClick={clearLogs}
            className="text-[9.5px] text-rose-400 hover:text-rose-350 font-bold border border-rose-950/60 px-2.5 py-1 hover:bg-rose-950/20 active:bg-rose-900/30 bg-black/40 transition-all uppercase rounded-md border-0 cursor-pointer shadow-md select-none"
          >
            [ LIMPAR_LOG ]
          </button>
        </div>
      </div>

      {/* Janela de Logs */}
      <div
        ref={containerRef}
        className="p-3.5 h-36 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent bg-slate-950/30"
      >
        {logs.map((log, index) => {
          let colorClass = "text-slate-300";
          if (log.includes("[SYSTEM]")) colorClass = "text-cyan-400 font-bold";
          else if (log.includes("FIRESTORE:")) colorClass = "text-emerald-400 font-semibold";
          else if (log.includes("SIMULATOR:")) colorClass = "text-amber-400/90";
          else if (log.includes("OPTIMISTIC:")) colorClass = "text-indigo-400 font-semibold";
          else if (log.includes("ERROR") || log.includes("FALHA")) colorClass = "text-rose-400 font-bold animate-pulse";
          else if (log.includes("REQUEST:")) colorClass = "text-slate-400";
          else if (log.includes("JOB:")) colorClass = "text-amber-500 font-medium";

          return (
            <div key={index} className={`leading-relaxed tracking-wide ${colorClass}`}>
              {log}
            </div>
          );
        })}
      </div>
    </div>
  );
}
