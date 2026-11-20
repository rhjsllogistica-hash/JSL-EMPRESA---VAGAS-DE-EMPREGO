import { CheckCircle2, Home, MessageSquare, Printer } from 'lucide-react';

export interface ConfirmationReceipt {
  applicationId: string;
  protocol: string;
  submittedAt: string;
  candidateName: string;
  jobTitle: string;
  status?: string;
}

interface ConfirmationPageProps {
  receipt: ConfirmationReceipt | null;
  lockedByIp?: boolean;
  onNavigate: (path: string) => void;
}

export function ConfirmationPage({
  receipt,
  lockedByIp = false,
  onNavigate,
}: ConfirmationPageProps) {
  if (!receipt) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-zinc-950">
          Nenhuma candidatura recente localizada
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Selecione uma vaga disponível para preencher e enviar sua candidatura.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/vagas')}
          className="mt-6 px-6 py-3 text-sm font-bold text-white bg-[#C8102E] rounded-xl hover:bg-[#A00D24] cursor-pointer"
        >
          Ver vagas disponíveis
        </button>
      </div>
    );
  }

  const formattedDate = new Date(receipt.submittedAt).toLocaleString('pt-BR');
  const displayStatus =
    receipt.status && receipt.status !== 'Recebida'
      ? receipt.status
      : 'Enviado — Aguardando 1ª etapa';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-10">
        <div className="flex items-center gap-3 text-emerald-700 mb-4">
          <CheckCircle2 className="w-8 h-8 shrink-0" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Protocolo registrado no sistema
          </span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
          ENVIADO COM SUCESSO!
        </h1>
        <p className="mt-2 text-base font-medium text-zinc-700">
          Aguarde o processo seletivo. Caso seja aprovado na 1ª etapa, o RH irá entrar em contato para entrevista.
        </p>

        <div className="mt-8 bg-zinc-50 border border-zinc-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-medium text-zinc-500">Número de protocolo</p>
            <p className="mt-1 font-mono-tabular text-xl font-bold text-[#C8102E]">
              {receipt.protocol}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500">Situação da candidatura</p>
            <p className="mt-1 text-base font-bold text-zinc-900">{displayStatus}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500">Nome do candidato</p>
            <p className="mt-1 text-base font-semibold text-zinc-900">{receipt.candidateName}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500">Cargo escolhido</p>
            <p className="mt-1 text-base font-semibold text-zinc-900">{receipt.jobTitle}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-zinc-500">Data da inscrição</p>
            <p className="mt-1 text-sm font-medium text-zinc-800 tabular-nums">{formattedDate}</p>
          </div>
        </div>

        <p className="mt-6 text-sm text-zinc-700 leading-relaxed bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
          Sua candidatura foi enviada e registrada com segurança. Aguarde o processo seletivo: caso seja aprovado na 1ª etapa, a equipe de RH entrará em contato pelos canais informados para agendar sua entrevista.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            Imprimir comprovante
          </button>
          {lockedByIp ? (
            <button
              type="button"
              onClick={() => onNavigate('/contato')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
              Falar com o RH
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl cursor-pointer"
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              Voltar para o início
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
