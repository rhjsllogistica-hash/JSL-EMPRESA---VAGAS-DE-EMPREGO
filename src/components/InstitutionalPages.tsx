import { useState, type FormEvent } from 'react';
import { CheckCircle2, Mail, MapPin, Phone, Send } from 'lucide-react';
import { submitContactMessage } from '../lib/recruitmentService.ts';
import { contactMessageSchema, formatPhoneBR } from '../lib/validation.ts';
import { CompanySettings } from '../types/recruitment.ts';

export function PrivacyPolicyPage({ settings }: { settings: CompanySettings }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-10 space-y-6">
        <div>
          <p className="text-xs font-semibold text-[#C8102E] mb-2">CONFORMIDADE LGPD</p>
          <h1 className="font-display text-3xl font-extrabold text-zinc-950 tracking-tight">
            Política de Privacidade e Proteção de Dados
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018)
          </p>
        </div>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="font-display text-lg font-bold text-zinc-950">
            1. Identificação do Controlador
          </h2>
          <p>
            <strong>Razão Social:</strong> {settings.legalName}
          </p>
          <p>
            <strong>CNPJ:</strong> {settings.cnpj}
          </p>
          <p>
            <strong>Endereço:</strong> {settings.address}
          </p>
          <p>
            <strong>Encarregado pelo Tratamento de Dados (DPO):</strong> {settings.dpoName} —{' '}
            {settings.dpoEmail}
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="font-display text-lg font-bold text-zinc-950">
            2. Finalidade da Coleta e Minimização de Dados
          </h2>
          <p>
            Os dados pessoais, profissionais, de contato, qualificações e anexos enviados neste
            portal são coletados exclusivamente para análise curricular, verificação de aderência
            aos requisitos operacionais da vaga selecionada, agendamento de entrevistas e gestão do
            processo seletivo.
          </p>
          <p>
            Em observância ao princípio da necessidade, não solicitamos CPF, RG, dados bancários,
            fotografia do rosto ou informações médicas/diagnósticos na etapa inicial de inscrição.
            Documentos pessoais obrigatórios para admissão são solicitados somente após aprovação
            para etapa de contratação.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="font-display text-lg font-bold text-zinc-950">
            3. Segurança, Armazenamento e Compartilhamento
          </h2>
          <p>
            As candidaturas e arquivos enviados são armazenados em ambiente privado com controle de
            acesso restrito à equipe de Recursos Humanos autorizada. Não comercializamos dados de
            candidatos nem utilizamos rastreadores de anúncios que enviem dados pessoais sensíveis.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="font-display text-lg font-bold text-zinc-950">
            4. Prazo de Retenção
          </h2>
          <p>
            Os dados vinculados ao processo seletivo são mantidos pelo prazo máximo de{' '}
            <strong className="tabular-nums">{settings.retentionDays} dias</strong> após o
            encerramento da seleção, salvo autorização opcional e destacada do candidato para banco
            de talentos ou obrigação legal aplicável.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="font-display text-lg font-bold text-zinc-950">
            5. Direitos do Titular e Canal de Atendimento
          </h2>
          <p>
            Você pode solicitar a confirmação de tratamento, acesso, correção, portabilidade ou
            eliminação definitiva de seus dados pessoais a qualquer momento através do e-mail{' '}
            <strong>{settings.dpoEmail}</strong> ou pela página de Contato.
          </p>
        </section>
      </div>
    </div>
  );
}

export function TermsOfUsePage({ settings }: { settings: CompanySettings }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-10 space-y-6">
        <div>
          <p className="text-xs font-semibold text-[#C8102E] mb-2">REGRAS DO PORTAL</p>
          <h1 className="font-display text-3xl font-extrabold text-zinc-950 tracking-tight">
            Termos de Uso do Portal de Carreiras
          </h1>
        </div>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="font-display text-lg font-bold text-zinc-950">1. Gratuidade e Lisura</h2>
          <p>
            A participação nos processos seletivos da {settings.brandName} é inteiramente gratuita.
            Não cobramos taxas de cadastro, cursos obrigatórios pagos ou depósitos via Pix.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="font-display text-lg font-bold text-zinc-950">
            2. Ausência de Garantia de Contratação
          </h2>
          <p>
            O envio da candidatura e a emissão de número de protocolo confirmam exclusivamente o
            recebimento dos dados para análise, não constituindo promessa ou garantia de
            contratação.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="font-display text-lg font-bold text-zinc-950">
            3. Veracidade das Informações
          </h2>
          <p>
            O candidato declara que as informações profissionais, qualificações e documentos
            anexados são verdadeiros. Valores salariais, escalas e benefícios anunciados estão
            sujeitos à confirmação administrativa e convenção coletiva vigente.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 leading-relaxed">
          <h2 className="font-display text-lg font-bold text-zinc-950">
            4. Identidade da Marca
          </h2>
          <p>{settings.brandDisclaimer}</p>
        </section>
      </div>
    </div>
  );
}

export function ContactPage({
  settings,
  channelPrefix = null,
}: {
  settings: CompanySettings;
  channelPrefix?: '/vagas1' | '/vagas2' | null;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const parsed = contactMessageSchema.safeParse({ name, email, phone, subject, message });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Verifique os campos preenchidos.');
      return;
    }

    setSubmitting(true);
    try {
      await submitContactMessage(parsed.data, channelPrefix);
      setSent(true);
      setName('');
      setEmail('');
      setPhone('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar sua mensagem agora. Tente novamente em instantes.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#C8102E] mb-2">ATENDIMENTO AO CANDIDATO</p>
            <h1 className="font-display text-3xl font-extrabold text-zinc-950 tracking-tight">
              Fale com a nossa equipe
            </h1>
            <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
              Dúvidas sobre vagas abertas, adaptações no processo seletivo ou solicitações de
              privacidade (LGPD)? Envie sua mensagem.
            </p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-zinc-500">Empresa Responsável</p>
              <p className="mt-0.5 font-semibold text-zinc-900">{settings.legalName}</p>
              <p className="text-xs text-zinc-500 mt-0.5">CNPJ: {settings.cnpj}</p>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#C8102E] shrink-0 mt-1" aria-hidden="true" />
              <span className="text-zinc-700">{settings.address}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#C8102E] shrink-0" aria-hidden="true" />
              <span className="text-zinc-700">{settings.institutionalEmail}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-[#C8102E] shrink-0" aria-hidden="true" />
              <span className="text-zinc-700">{settings.institutionalPhone}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8">
            {sent ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" aria-hidden="true" />
                <h2 className="font-display text-xl font-bold text-zinc-950">
                  Mensagem enviada com sucesso
                </h2>
                <p className="text-sm text-zinc-600">
                  Nossa equipe de Recrutamento responderá pelo e-mail informado assim que possível.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="mt-2 px-5 py-2.5 text-sm font-semibold text-white bg-zinc-900 rounded-xl cursor-pointer"
                >
                  Enviar outra mensagem
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="font-display text-xl font-bold text-zinc-950 mb-2">
                  Formulário de Contato
                </h2>

                {error && (
                  <div
                    role="alert"
                    className="p-3.5 text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl"
                  >
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                      Nome completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                      E-mail *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                      Assunto *
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Ex.: Dúvida sobre vaga ou LGPD"
                      className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                    Mensagem *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl disabled:opacity-60 cursor-pointer"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  {submitting ? 'Enviando...' : 'Enviar mensagem'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotFoundPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="font-mono-tabular text-sm font-bold text-[#C8102E]">ERRO 404</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-zinc-950">
        Página não encontrada
      </h1>
      <p className="mt-3 text-base text-zinc-600">
        O endereço acessado não existe ou foi movido. Confira as vagas abertas no portal.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="px-6 py-3 text-sm font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
        >
          Ir para o início
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/vagas')}
          className="px-6 py-3 text-sm font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl cursor-pointer"
        >
          Ver vagas disponíveis
        </button>
      </div>
    </div>
  );
}
