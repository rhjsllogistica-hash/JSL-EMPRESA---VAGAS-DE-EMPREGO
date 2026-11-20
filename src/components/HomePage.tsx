import { useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronRight, ShieldCheck } from 'lucide-react';
import { HERO_IMAGE_PATH } from '../data/defaultJobs.ts';
import { JobPosting } from '../types/recruitment.ts';
import { ImageWithFallback } from './ImageWithFallback.tsx';

interface HomePageProps {
  jobs: JobPosting[];
  brandSubtitle: string;
  onSelectJobForApplication: (job: JobPosting) => void;
  onViewJobDetails: (job: JobPosting) => void;
  onNavigate: (path: string) => void;
}

export function HomePage({
  jobs,
  brandSubtitle,
  onSelectJobForApplication,
  onViewJobDetails,
  onNavigate,
}: HomePageProps) {
  const [areaFilter, setAreaFilter] = useState<'todas' | 'motorista' | 'operacional'>('todas');

  const filteredJobs = jobs.filter((job) => {
    if (areaFilter === 'todas') return true;
    if (areaFilter === 'motorista') {
      return job.roleType === 'motorista_caminhao' || job.roleType === 'motorista_fiorino';
    }
    return (
      job.roleType === 'operador_empilhadeira' ||
      job.roleType === 'auxiliar_logistica' ||
      job.roleType === 'conferente_pacotes'
    );
  });

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-stretch">
            <div className="order-2 lg:order-1 lg:col-span-6 flex flex-col justify-center space-y-6">
              <p className="text-xs sm:text-sm font-bold tracking-wide text-[#C8102E]">
                JSL - LOGÍSTICA · {brandSubtitle}
              </p>

              <h1
                className="font-display font-extrabold text-zinc-950 tracking-tight leading-[1.06]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
              >
                Faça parte da <span className="text-[#C8102E]">nossa equipe!</span>
              </h1>

              <p className="text-base sm:text-lg text-zinc-600 leading-relaxed max-w-xl">
                Conheça as oportunidades de trabalho nas áreas de transporte, distribuição e
                logística. Consulte salários iniciais, benefícios e requisitos antes de iniciar sua
                candidatura pelo celular ou computador.
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
                <a
                  href="#vagas-disponiveis"
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById('vagas-disponiveis')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center justify-center gap-2.5 px-7 py-4 text-base font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl shadow-sm transition-colors min-h-[52px] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  VER VAGAS DISPONÍVEIS
                  <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => onNavigate('/privacidade')}
                  className="inline-flex items-center justify-center px-5 py-3.5 text-sm font-semibold text-zinc-700 hover:text-[#C8102E] border border-zinc-300 hover:border-[#C8102E]/40 rounded-xl transition-colors min-h-[48px] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Privacidade e LGPD
                </button>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-zinc-500">
                <span>Processo seletivo gratuito</span>
                <span aria-hidden="true">·</span>
                <span>Contratação CLT</span>
                <span aria-hidden="true">·</span>
                <span>Inscrição rápida pelo celular</span>
              </div>
            </div>

            <div className="order-1 lg:order-2 lg:col-span-6 flex items-center">
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-zinc-200 shadow-lg bg-zinc-900">
                <ImageWithFallback
                  src={HERO_IMAGE_PATH}
                  alt="Colaboradores da JSL Empresa em frente a caminhão vermelho no centro logístico com a mensagem Venha trabalhar conosco"
                  className="w-full h-full object-cover"
                  fallbackTitle="Operações de Transporte e Distribuição"
                />
              </div>
            </div>
          </div>

          {/* Faixa institucional vermelho e branco abaixo do hero */}
          <div className="mt-10 bg-[#C8102E] text-white rounded-2xl p-6 sm:p-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 shadow-sm">
            <div>
              <p className="text-xs font-medium text-red-100">Áreas com vagas abertas</p>
              <p className="mt-1 font-display text-lg font-extrabold text-white tabular-nums">
                {jobs.length} funções operacionais
              </p>
            </div>
            <div className="sm:border-l sm:border-white/20 sm:pl-6">
              <p className="text-xs font-medium text-red-100">Benefícios padrão divulgados</p>
              <p className="mt-1 font-display text-lg font-extrabold text-white tabular-nums">
                VT + VR R$ 30,00/dia
              </p>
            </div>
            <div className="lg:border-l lg:border-white/20 lg:pl-6">
              <p className="text-xs font-medium text-red-100">Regime de contratação</p>
              <p className="mt-1 font-display text-lg font-extrabold text-white">
                CLT com carteira assinada
              </p>
            </div>
            <div className="sm:border-l sm:border-white/20 sm:pl-6">
              <p className="text-xs font-medium text-red-100">Acompanhamento de candidatura</p>
              <p className="mt-1 font-display text-lg font-extrabold text-white">
                Protocolo único imediato
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Vagas Disponíveis */}
      <section
        id="vagas-disponiveis"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-[#C8102E] mb-2">
              OPORTUNIDADES ABERTAS
            </p>
            <h2
              className="font-display text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Vagas disponíveis para candidatura
            </h2>
            <p className="mt-2 text-base text-zinc-600">
              Leia atentamente os requisitos, condições de trabalho e atividades de cada função. A
              seleção da vaga é obrigatória antes do preenchimento do cadastro.
            </p>
          </div>

          <div
            role="group"
            aria-label="Filtrar vagas por área"
            className="inline-flex items-center gap-1 p-1 bg-zinc-100 border border-zinc-200 rounded-xl self-start"
          >
            <button
              type="button"
              onClick={() => setAreaFilter('todas')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                areaFilter === 'todas'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Todas ({jobs.length})
            </button>
            <button
              type="button"
              onClick={() => setAreaFilter('motorista')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                areaFilter === 'motorista'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Motoristas
            </button>
            <button
              type="button"
              onClick={() => setAreaFilter('operacional')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                areaFilter === 'operacional'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Galpão e Logística
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredJobs.map((job) => (
            <article
              key={job.id}
              className="bg-white border border-zinc-200 border-t-2 border-t-[#C8102E] rounded-2xl p-6 sm:p-7 flex flex-col justify-between shadow-sm hover:shadow-md transition-all"
            >
              <div>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-zinc-100">
                  <div>
                    <h3 className="font-display text-xl sm:text-2xl font-bold text-zinc-950">
                      {job.title}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-zinc-500">
                      <span>{job.department}</span>
                      <span aria-hidden="true">·</span>
                      <span>{job.contractType}</span>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <p className="text-xs font-medium text-zinc-500">Salário inicial</p>
                    <p className="font-display text-xl font-extrabold text-[#C8102E] tabular-nums">
                      {job.salaryDisplay}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <p className="text-sm text-zinc-700 leading-relaxed">{job.summary}</p>

                  <div className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 space-y-1">
                    <p>
                      <strong className="text-zinc-900">Jornada / Escala:</strong> {job.schedule}
                    </p>
                    <p>
                      <strong className="text-zinc-900">Experiência:</strong> {job.experienceNote}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 mb-2">
                        Requisitos principais
                      </h4>
                      <ul className="space-y-1.5 text-sm text-zinc-600">
                        {job.requirements.slice(0, 4).map((req, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-[#C8102E] font-bold mt-0.5" aria-hidden="true">
                              •
                            </span>
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 mb-2">
                        Benefícios e condições
                      </h4>
                      <ul className="space-y-1.5 text-sm text-zinc-600">
                        {job.benefits.map((ben, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2
                              className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>{ben}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {!job.salaryConfirmed && (
                    <p className="text-[11px] leading-relaxed text-zinc-500 border-t border-zinc-100 pt-3">
                      {job.collectiveAgreementNote}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-zinc-100 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => onViewJobDetails(job)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors min-h-[46px] cursor-pointer"
                >
                  VER DETALHES
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectJobForApplication(job)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl transition-colors min-h-[46px] cursor-pointer"
                >
                  CANDIDATAR-ME
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Como Funciona o Processo Seletivo */}
      <section
        id="como-funciona"
        className="bg-white border-y border-zinc-200 py-14 lg:py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-semibold tracking-wide text-[#C8102E] mb-2">
              ETAPAS DO PROCESSO
            </p>
            <h2
              className="font-display text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Como funciona a seleção na JSL Empresa
            </h2>
            <p className="mt-2 text-base text-zinc-600">
              Nosso fluxo foi estruturado para ser rápido no celular, transparente em cada etapa e
              respeitoso com seus dados pessoais.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-2.5">
              <p className="font-display text-sm font-bold text-[#C8102E]">
                01. Escolha da vaga
              </p>
              <h3 className="font-display text-lg font-bold text-zinc-900">
                Consulte requisitos e remuneração
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Veja todas as atividades, escala e benefícios antes de preencher seus dados. Você
                seleciona a vaga desejada e o formulário se adapta à função.
              </p>
            </div>

            <div className="space-y-2.5">
              <p className="font-display text-sm font-bold text-[#C8102E]">
                02. Cadastro profissional
              </p>
              <h3 className="font-display text-lg font-bold text-zinc-900">
                Histórico e currículo em etapas
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Informe contatos, escolaridade, disponibilidade e, caso deseje, anexe seu currículo
                ou documento de forma opcional.
              </p>
            </div>

            <div className="space-y-2.5">
              <p className="font-display text-sm font-bold text-[#C8102E]">
                03. Protocolo e análise
              </p>
              <h3 className="font-display text-lg font-bold text-zinc-900">
                Recebimento confirmado pelo sistema
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Ao concluir, você recebe um número de protocolo único. Nossa equipe de RH analisa os
                perfis compatíveis com cada operação.
              </p>
            </div>

            <div className="space-y-2.5">
              <p className="font-display text-sm font-bold text-[#C8102E]">
                04. Contato e entrevista
              </p>
              <h3 className="font-display text-lg font-bold text-zinc-900">
                Etapas presenciais ou remotas
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Caso sua candidatura avance, entraremos em contato pelos canais informados para
                alinhamento, entrevista e orientações futuras.
              </p>
            </div>
          </div>

          <div className="mt-12 bg-zinc-50 border border-zinc-200 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#C8102E] text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-zinc-950">
                  Compromisso contra fraudes e proteção de dados (LGPD)
                </h3>
                <p className="mt-1 text-sm text-zinc-600 max-w-2xl leading-relaxed">
                  Nunca cobramos taxas de inscrição, exames prévios pagos por Pix ou depósitos
                  bancários. Os dados preenchidos e eventuais documentos enviados são utilizados
                  exclusivamente para análise do processo seletivo conforme a LGPD.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/contato')}
              className="px-5 py-3 text-sm font-semibold text-zinc-900 bg-white border border-zinc-300 hover:border-[#C8102E] hover:text-[#C8102E] rounded-xl whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              Falar com o RH
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
