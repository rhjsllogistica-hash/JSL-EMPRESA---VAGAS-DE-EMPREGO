import { useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronRight, Search } from 'lucide-react';
import { JobPosting } from '../types/recruitment.ts';

interface JobsListPageProps {
  jobs: JobPosting[];
  onSelectJobForApplication: (job: JobPosting) => void;
  onViewJobDetails: (job: JobPosting) => void;
}

export function JobsListPage({
  jobs,
  onSelectJobForApplication,
  onViewJobDetails,
}: JobsListPageProps) {
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<'todas' | 'motorista' | 'operacional'>('todas');

  const filtered = jobs.filter((job) => {
    const matchesSearch =
      !search.trim() ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.department.toLowerCase().includes(search.toLowerCase()) ||
      job.summary.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="max-w-3xl mb-6 sm:mb-8">
        <p className="text-xs font-bold tracking-wide text-[#C8102E] mb-2">
          PORTAL DE VAGAS · JSL - LOGÍSTICA
        </p>
        <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight">
          Vagas disponíveis
        </h1>
        <p className="mt-2 text-sm sm:text-base text-zinc-600">
          Selecione a oportunidade desejada para conferir todos os detalhes ou iniciar sua
          candidatura.
        </p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="relative w-full md:flex-1 md:max-w-md">
          <Search
            className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cargo ou área..."
            aria-label="Buscar vagas por cargo ou área"
            className="w-full pl-10 pr-4 py-3 text-base sm:text-sm bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
          />
        </div>

        <div
          role="group"
          aria-label="Filtrar vagas por área"
          className="w-full md:w-auto max-w-full overflow-x-auto no-scrollbar self-start"
        >
          <div className="inline-flex items-center gap-1 p-1 bg-zinc-100 border border-zinc-200 rounded-xl min-w-max">
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
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 sm:p-10 text-center">
          <p className="font-display text-lg font-bold text-zinc-900">
            Nenhuma vaga encontrada para este filtro.
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            Limpe a busca ou visualize todas as funções disponíveis.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setAreaFilter('todas');
            }}
            className="mt-4 px-5 py-2.5 text-sm font-semibold text-white bg-zinc-900 rounded-xl hover:bg-zinc-800 cursor-pointer min-h-[44px]"
          >
            Mostrar todas as vagas
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          {filtered.map((job) => (
            <article
              key={job.id}
              className="bg-white border border-zinc-200 border-t-2 border-t-[#C8102E] rounded-2xl p-5 sm:p-7 flex flex-col justify-between shadow-sm hover:shadow-md transition-all"
            >
              <div>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-zinc-100">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg sm:text-2xl font-bold text-zinc-950">
                      {job.title}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-zinc-500">
                      <span>{job.department}</span>
                      <span aria-hidden="true">·</span>
                      <span>{job.contractType}</span>
                    </div>
                  </div>
                  <div className="sm:text-right shrink-0">
                    <p className="text-xs font-medium text-zinc-500">Salário inicial</p>
                    <p className="font-display text-lg sm:text-xl font-extrabold text-[#C8102E] tabular-nums">
                      {job.salaryDisplay}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-zinc-700 leading-relaxed">{job.summary}</p>
                <p className="mt-3 text-xs text-zinc-600">
                  <strong className="text-zinc-900">Escala/Jornada:</strong> {job.schedule}
                </p>

                <ul className="mt-4 space-y-1.5 text-sm text-zinc-600">
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

                {!job.salaryConfirmed && (
                  <p className="mt-4 text-[11px] text-zinc-500 border-t border-zinc-100 pt-3">
                    {job.collectiveAgreementNote}
                  </p>
                )}
              </div>

              <div className="mt-6 pt-5 border-t border-zinc-100 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => onViewJobDetails(job)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors min-h-[48px] cursor-pointer"
                >
                  VER DETALHES
                  <ChevronRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectJobForApplication(job)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl transition-colors min-h-[48px] cursor-pointer"
                >
                  CANDIDATAR-ME
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
