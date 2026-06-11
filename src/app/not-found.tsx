"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-height-screen flex flex-col items-center justify-center min-h-screen px-4 bg-[#0e0817] text-[#eeeaf6] font-sans relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-[#8b5cf6]/10 to-[#007aff]/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="glass-panel-evolution p-8 md:p-12 rounded-2xl max-w-md w-full text-center border border-white/5 relative z-10">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#8b5cf6] to-[#007aff] flex items-center justify-center shadow-lg shadow-[#007aff]/20 animate-pulse">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4 font-heading bg-gradient-to-r from-[#eeeaf6] to-[#8b5cf6] bg-clip-text text-transparent">
          404
        </h1>
        <h2 className="text-xl font-medium mb-3 text-[#c49eff]">
          Rota Não Encontrada
        </h2>
        <p className="text-[#8a82a8] text-sm mb-8 leading-relaxed">
          O destino que você tentou acessar não foi mapeado no nosso centro de controle. Talvez a rota tenha mudado ou o plano de voo foi cancelado.
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#007aff] text-white font-medium hover:from-[#7c3aed] hover:to-[#0062cc] transition-all duration-300 shadow-md hover:shadow-[#007aff]/30 active:scale-[0.98] w-full"
        >
          Retornar ao Centro de Controle
        </Link>
      </div>
    </div>
  );
}
