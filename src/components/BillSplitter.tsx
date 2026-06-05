"use client";

import React from "react";
import { Despesa } from "@/services/travelService";

interface BillSplitterProps {
  viajantes: string[];
  despesas: Despesa[];
  usuarioAtualId: string;
}

interface Transacao {
  de: string;
  para: string;
  valor: number;
}

export default function BillSplitter({
  viajantes = [],
  despesas = [],
  usuarioAtualId,
}: BillSplitterProps) {
  // Ajusta nomes amigáveis para exibição
  const formatNome = (nome: string) => {
    if (nome === usuarioAtualId) return "Você";
    return nome;
  };

  // 1. Calcula o saldo líquido de cada viajante
  const balancos: Record<string, number> = {};
  
  // Inicializa todos com saldo 0
  viajantes.forEach((v) => {
    balancos[v] = 0;
  });

  despesas.forEach((exp) => {
    const total = exp.valor || 0;
    const pagador = exp.pagoPor || usuarioAtualId;
    
    // Se o pagador não estiver na lista de viajantes atual, adicionamos para não quebrar a conta
    if (balancos[pagador] === undefined) {
      balancos[pagador] = 0;
    }

    // Crédito para quem pagou
    balancos[pagador] += total;

    // Divisão entre os escolhidos (se vazio, divide entre todos os viajantes cadastrados)
    const splitters = exp.divididoCom && exp.divididoCom.length > 0
      ? exp.divididoCom
      : viajantes;

    const valorPorPessoa = total / (splitters.length || 1);

    splitters.forEach((splitter) => {
      if (balancos[splitter] === undefined) {
        balancos[splitter] = 0;
      }
      balancos[splitter] -= valorPorPessoa;
    });
  });

  // 2. Calcula as transferências sugeridas (Algoritmo Guloso de Minimização de Dívidas)
  const credores: { nome: string; saldo: number }[] = [];
  const devedores: { nome: string; saldo: number }[] = [];

  Object.entries(balancos).forEach(([nome, saldo]) => {
    const rounded = Math.round(saldo * 100) / 100;
    if (rounded > 0.01) {
      credores.push({ nome, saldo: rounded });
    } else if (rounded < -0.01) {
      devedores.push({ nome, saldo: Math.abs(rounded) });
    }
  });

  // Ordena para casar saldos com facilidade
  credores.sort((a, b) => b.saldo - a.saldo);
  devedores.sort((a, b) => b.saldo - a.saldo);

  const transacoes: Transacao[] = [];
  
  let i = 0;
  let j = 0;

  // Cria cópias de trabalho
  const credoresWork = credores.map((c) => ({ ...c }));
  const devedoresWork = devedores.map((d) => ({ ...d }));

  while (i < credoresWork.length && j < devedoresWork.length) {
    const credor = credoresWork[i];
    const devedor = devedoresWork[j];

    const valorTransferido = Math.min(credor.saldo, devedor.saldo);

    transacoes.push({
      de: devedor.nome,
      para: credor.nome,
      valor: Math.round(valorTransferido * 100) / 100,
    });

    credor.saldo -= valorTransferido;
    devedor.saldo -= valorTransferido;

    if (credor.saldo < 0.01) i++;
    if (devedor.saldo < 0.01) j++;
  }

  const ultrapassouLimite = credores.length > 0 || devedores.length > 0;

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-md relative overflow-hidden select-none space-y-5">
      <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-[#f59e0b] to-amber-600" />
      
      <div className="flex items-center justify-between border-b border-slate-850 pb-2">
        <h3 className="text-[10px] font-black uppercase text-amber-500 tracking-wider flex items-center gap-1.5">
          <span>🤝 Divisão de Contas (Splitwise)</span>
        </h3>
        <span className="text-[8px] text-slate-550 lowercase italic">acerto de contas</span>
      </div>

      {/* Grid de Saldos Individuais */}
      <div className="space-y-2">
        <div className="text-[9.5px] font-bold text-slate-450 uppercase tracking-wider">
          Saldos Individuais
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {viajantes.map((v) => {
            const saldo = balancos[v] || 0;
            const isCredito = saldo > 0.01;
            const isDebito = saldo < -0.01;
            
            let statusColor = "text-slate-400";
            let prefix = "";
            let textLabel = "está quites";
            
            if (isCredito) {
              statusColor = "text-emerald-450";
              prefix = "+";
              textLabel = "recebe";
            } else if (isDebito) {
              statusColor = "text-rose-450";
              prefix = "-";
              textLabel = "deve";
            }

            return (
              <div
                key={v}
                className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-[10px] font-medium"
              >
                <span className="text-slate-200 font-bold uppercase">{formatNome(v)}</span>
                <div className="text-right">
                  <span className={`font-mono font-bold ${statusColor}`}>
                    {prefix}R$ {Math.abs(saldo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                    {textLabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resoluções Sugeridas */}
      <div className="space-y-2 pt-1">
        <div className="text-[9.5px] font-bold text-slate-450 uppercase tracking-wider">
          Transferências Sugeridas
        </div>
        
        {!ultrapassouLimite ? (
          <div className="border border-dashed border-slate-850 p-4 text-center text-slate-500 font-semibold text-[9.5px] rounded-xl bg-slate-950/10 shadow-inner">
            🎉 Todos estão quites! Nenhuma transferência é necessária.
          </div>
        ) : (
          <div className="border border-slate-850 divide-y divide-slate-850/60 bg-slate-950/40 rounded-xl overflow-hidden shadow-inner">
            {transacoes.map((t, idx) => (
              <div
                key={idx}
                className="p-3 flex items-center justify-between gap-3 text-[10px] hover:bg-slate-900/10 transition-colors"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-rose-400 uppercase">{formatNome(t.de)}</span>
                  <span className="text-slate-500">deve transferir para</span>
                  <span className="font-bold text-emerald-400 uppercase">{formatNome(t.para)}</span>
                </div>
                <div className="font-mono font-bold text-[#f59e0b] bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                  R$ {t.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
