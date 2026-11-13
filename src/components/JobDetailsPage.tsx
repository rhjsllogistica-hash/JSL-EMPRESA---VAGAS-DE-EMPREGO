import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { JobPosting } from '../types/recruitment.ts';
import { ImageWithFallback } from './ImageWithFallback.tsx';

interface JobDetailsPageProps {
  job: JobPosting;
  onSelectJobForApplication: (job: JobPosting) => void;
  onBack: () => void;
}

export function JobDetailsPage({
  job,
  onSelectJobForApplication,
  onBack,
}: JobDetailsPageProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950 mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Voltar para vagas disponíveis
      </button>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 border-b border-zinc-200">
          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-[#C8102E] mb-2">
                {job.department} · {job.contractType}
              </p>
              <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight">
                {job.title}
              </h1>
              <p className="mt-3 text-base text-zinc-600 leading-relaxed">{job.summary}</p>
            </div>

            <div className="mt-6 pt-6 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-zinc-500">Salário inicial mensal</p>
                <p className="font-display text-2xl sm:text-3xl font-extrabold text-[#C8102E] tabular-nums">
                  {job.salaryDisplay}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onSelectJobForApplication(job)}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 text-base font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl transition-colors min-h-[52px] whitespace-nowrap shrink-0 cursor-pointer"
              >
                CANDIDATAR-ME
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="md:col-span-5 h-56 md:h-auto min-h-[240px] bg-zinc-900">
            <ImageWithFallback
              src={job.imageUrl}
              alt={`Ambiente operacional para a vaga de ${job.title}`}
              className="w-full h-full object-cover"
              fallbackTitle={job.title}
            />
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50 border border-zinc-200 rounded-xl p-5 text-sm">
            <div>
              <p className="text-xs font-semibold text-zinc-500">Escala e Jornada</p>
              <p className="mt-1 font-medium text-zinc-900">{job.schedule}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500">Experiência Anterior</p>
              <p className="mt-1 font-medium text-zinc-900">{job.experienceNote}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-950 mb-3">Requisitos</h2>
              <ul className="space-y-2.5 text-sm text-zinc-700">
                {job.requirements.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="text-[#C8102E] font-bold mt-0.5" aria-hidden="true">
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-zinc-950 mb-3">
                Atividades da Função
              </h2>
              <ul className="space-y-2.5 text-sm text-zinc-700">
                {job.activities.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="text-[#C8102E] font-bold mt-0.5" aria-hidden="true">
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-zinc-200">
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-950 mb-3">
                Condições de Trabalho
              </h2>
              <ul className="space-y-2.5 text-sm text-zinc-700">
                {job.conditions.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="text-zinc-900 font-bold mt-0.5" aria-hidden="true">
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-zinc-950 mb-3">Benefícios</h2>
              <ul className="space-y-2.5 text-sm text-zinc-700">
                {job.benefits.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="w-4 h-4 text-[#C8102E] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {!job.salaryConfirmed && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs text-zinc-600 leading-relaxed">
              <strong className="text-zinc-900">Nota administrativa e legal:</strong>{' '}
              {job.collectiveAgreementNote}
            </div>
          )}

          <div className="pt-6 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-xs text-zinc-500">
              Inscrição gratuita. A submissão da candidatura não garante contratação.
            </p>
            <button
              type="button"
              onClick={() => onSelectJobForApplication(job)}
              className="inline-flex items-center justify-center gap-2 px-7 py-4 text-base font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl transition-colors min-h-[52px] cursor-pointer"
            >
              CANDIDATAR-ME PARA {job.title.toUpperCase()}
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
