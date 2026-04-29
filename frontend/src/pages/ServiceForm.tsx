import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lightbulb, Users as UsersIcon } from 'lucide-react';
import api from '../api';
import type { User } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function ServiceForm() {
  const [searchParams] = useSearchParams();
  const initialAssetId = searchParams.get('asset') || '';
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [assets, setAssets] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [historicalSuggestions, setHistoricalSuggestions] = useState<string[]>([]);
  const [pastServices, setPastServices] = useState<any[]>([]);
  
  // Estados para os Dropdowns Específicos
  const [naturalInfluenceSelect, setNaturalInfluenceSelect] = useState('');
  const [naturalInfluenceCustom, setNaturalInfluenceCustom] = useState('');
  
  const [pipingMaterialSelect, setPipingMaterialSelect] = useState('PVC');
  const [pipingMaterialCustom, setPipingMaterialCustom] = useState('');

  const [replacedPartsBool, setReplacedPartsBool] = useState('false');
  const [replacedPartsText, setReplacedPartsText] = useState('');

  // ML Custom Questions
  const [extraQuestions, setExtraQuestions] = useState<{question: string, answer: string}[]>([]);
  const [savedQuestions, setSavedQuestions] = useState<string[]>([]);

  // Telemetry specific
  const [telemetrySignal, setTelemetrySignal] = useState('');
  const [telemetryAntenna, setTelemetryAntenna] = useState('');
  const [telemetryPower, setTelemetryPower] = useState('');

  // Inverter specific
  const [inverterVoltage, setInverterVoltage] = useState('');
  const [inverterCurrent, setInverterCurrent] = useState('');
  const [inverterPanel, setInverterPanel] = useState('');

  const [form, setForm] = useState({
    asset_id: initialAssetId,
    date: new Date().toISOString().split('T')[0],
    macro_type: 'Preventiva',
    category: 'Macromedição',
    is_closed_system: 'true',
    diameter_mm: '',
    electrical_interferences: 'false',
    materials_used: '',
  });

  const [loading, setLoading] = useState(false);
  const [success] = useState(false);

  useEffect(() => {
    // Busca ativos e usuários aprovados
    Promise.all([
      api.get('/assets'),
      api.get('/users')
    ]).then(([assetsRes, usersRes]) => {
      setAssets(assetsRes.data);
      setUsers(usersRes.data);
    }).catch(console.error);

    // Carregar perguntas salvas anteriormente para auto-completar
    try {
      const saved = localStorage.getItem('nuiam_custom_questions');
      if (saved) {
        setSavedQuestions(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Monitorar mudança do asset para carregar histórico e prever peças
  useEffect(() => {
    if (form.asset_id) {
      api.get(`/assets/${form.asset_id}`)
        .then(res => {
           const history = res.data.services || [];
           // Extrair e deduzir peças trocadas anteriormente
           const parts = history
             .map((s: any) => s.replaced_parts)
             .filter(Boolean);
           
           // Pega os itens unicos quebados por vírgula e junta
           const uniquePartsSet = new Set<string>();
           parts.forEach((p: string) => {
             p.split(',').map(item => item.trim()).filter(Boolean).forEach(i => uniquePartsSet.add(i));
           });
           setHistoricalSuggestions(Array.from(uniquePartsSet));
           setPastServices(history);
        })
        .catch(console.error);
    } else {
       setHistoricalSuggestions([]);
       setPastServices([]);
    }
  }, [form.asset_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.asset_id) return alert('Selecione um ativo');
    
    // Resolver os valores finais (Select vs Custom)
    const finalNaturalInfluence = naturalInfluenceSelect === 'Outro' ? naturalInfluenceCustom : naturalInfluenceSelect;
    const finalPipingMaterial = pipingMaterialSelect === 'Outro' ? pipingMaterialCustom : pipingMaterialSelect;

    // Inject Category Specifics
    let categoryNotes = '';
    if (form.category === 'Telemetria') {
      const parts = [];
      if (telemetrySignal) parts.push(`Sinal: ${telemetrySignal}`);
      if (telemetryAntenna) parts.push(`Antena: ${telemetryAntenna}`);
      if (telemetryPower) parts.push(`Fonte: ${telemetryPower}`);
      if (parts.length > 0) categoryNotes = `[Telemetria] ${parts.join(' | ')}\n\n`;
    } else if (form.category === 'Inversor') {
      const parts = [];
      if (inverterVoltage) parts.push(`Tensão(V): ${inverterVoltage}`);
      if (inverterCurrent) parts.push(`Corrente(A): ${inverterCurrent}`);
      if (inverterPanel) parts.push(`Painel: ${inverterPanel}`);
      if (parts.length > 0) categoryNotes = `[Inversor] ${parts.join(' | ')}\n\n`;
    }

    finalNotes = categoryNotes + finalNotes;

    // Formatar perguntas extras
    if (extraQuestions.length > 0) {
      const validQs = extraQuestions.filter(q => q.question.trim() !== '');
      if (validQs.length > 0) {
        const qsString = validQs.map(q => `${q.question}: ${q.answer}`).join(' | ');
        finalNotes = `[Checklist Customizado] ${qsString}\n\n${finalNotes}`;
        
        // Save new questions to localStorage
        const newSavedQs = new Set([...savedQuestions, ...validQs.map(q => q.question.trim())]);
        const newSavedArr = Array.from(newSavedQs);
        setSavedQuestions(newSavedArr);
        localStorage.setItem('nuiam_custom_questions', JSON.stringify(newSavedArr));
      }
    }

    setLoading(true);
    try {
      await api.post('/services', {
        asset_id: parseInt(form.asset_id),
        date: form.date,
        macro_type: form.macro_type,
        category: form.category,
        is_closed_system: form.is_closed_system === 'true',
        piping_material: finalPipingMaterial,
        diameter_mm: parseFloat(form.diameter_mm) || null,
        natural_influences: finalNaturalInfluence,
        electrical_interferences: form.electrical_interferences === 'true',
        materials_used: finalNotes,
        replaced_parts: replacedPartsBool === 'true' ? replacedPartsText : null,
        user_ids: selectedUserIds
      });
      setForm(prev => ({ ...prev, materials_used: '', diameter_mm: '', date: new Date().toISOString().split('T')[0] }));
      setNaturalInfluenceSelect('');
      setNaturalInfluenceCustom('');
      setPipingMaterialSelect('PVC');
      setPipingMaterialCustom('');
      setReplacedPartsBool('false');
      setReplacedPartsText('');
      setExtraQuestions([]);
      setTelemetrySignal('');
      setTelemetryAntenna('');
      setTelemetryPower('');
      setInverterVoltage('');
      setInverterCurrent('');
      setInverterPanel('');
      setSelectedUserIds([]);
      addToast('Serviço registrado com sucesso! O checklist foi salvo no histórico do ativo.', 'success');
      navigate('/assets');
    } catch (err) {
      console.error(err);
      addToast('Ocorreu um erro ao salvar o serviço. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <h1 className="text-2xl font-bold text-slate-800">Registrar Intervenção Técnica</h1>
      
      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg border border-green-200 font-medium">
          Serviço registrado com sucesso! O status do ativo foi atualizado.
        </div>
      )}

      {historicalSuggestions.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-4 items-start shadow-sm animate-in fade-in slide-in-from-top-4">
          <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
             <Lightbulb size={24} />
          </div>
          <div>
            <h3 className="text-indigo-900 font-bold mb-1">Sugestão Inteligente de Materiais</h3>
            <p className="text-indigo-800 text-sm mb-2">Historicamente, este ativo já precisou da substituição dos seguintes componentes. Considere levá-los de reserva:</p>
            <div className="flex flex-wrap gap-2">
              {historicalSuggestions.map((part, idx) => (
                <span key={idx} className="bg-white/60 border border-indigo-200 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold">
                  {part}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {pastServices.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-4">
          <h3 className="text-slate-800 font-bold mb-3 flex items-center gap-2">
            Histórico Recente de Vistorias neste Ativo
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Macro-Tipo</th>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2">Anotações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pastServices.slice(0, 5).map((sec, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{sec.date}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${sec.macro_type === 'Preventiva' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                         {sec.macro_type}
                      </span>
                    </td>
                    <td className="px-3 py-2">{sec.category}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate" title={sec.materials_used}>{sec.materials_used || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pastServices.length > 5 && (
            <div className="text-xs text-center text-slate-500 mt-2">
              Mostrando 5 de {pastServices.length} registros.
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Identificação</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data da Intervenção</label>
              <input 
                type="date"
                value={form.date}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setForm({...form, date: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Selecione o Ativo (Tag)</label>
              <select 
                value={form.asset_id} 
                onChange={e => setForm({...form, asset_id: e.target.value})} 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                required
              >
                <option value="">Selecione...</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.tag} - {a.category}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Macro-Tipo de Manutenção</label>
              <select 
                value={form.macro_type} 
                onChange={e => setForm({...form, macro_type: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="Preventiva">Preventiva</option>
                <option value="Corretiva">Corretiva</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
              <select 
                value={form.category} 
                onChange={e => setForm({...form, category: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="Macromedição">Macromedição</option>
                <option value="Telemetria">Telemetria</option>
                <option value="Inversor">Inversor</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <UsersIcon size={20} className="text-slate-500" /> Profissionais Envolvidos
          </h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Quem fez a atividade? (Selecione um ou mais)</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {users.map(u => (
                <label key={u.id} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                  <input 
                    type="checkbox"
                    checked={selectedUserIds.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUserIds([...selectedUserIds, u.id]);
                      } else {
                        setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                      }
                    }}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">{u.full_name}</span>
                </label>
              ))}
              {users.length === 0 && <span className="text-sm text-slate-500">Nenhum técnico cadastrado ou aprovado...</span>}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Checklist Técnico</h2>
          
          {/* Campos Específicos por Categoria */}
          {form.category === 'Macromedição' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
               <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sistema Aberto ou Fechado?</label>
                <select 
                  value={form.is_closed_system} 
                  onChange={e => setForm({...form, is_closed_system: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="true">Fechado</option>
                  <option value="false">Aberto</option>
                </select>
              </div>

              {/* Material de Tubulação com customização */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Material da Tubulação</label>
                <select 
                  value={pipingMaterialSelect} 
                  onChange={e => setPipingMaterialSelect(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none mb-2"
                >
                  <option value="PVC">PVC</option>
                  <option value="Ferro Fundido">Ferro Fundido</option>
                  <option value="Aço Carbono">Aço Carbono</option>
                  <option value="PAD">PAD</option>
                  <option value="Outro">Adicionar nova opção...</option>
                </select>
                {pipingMaterialSelect === 'Outro' && (
                  <input 
                    type="text"
                    value={pipingMaterialCustom}
                    onChange={e => setPipingMaterialCustom(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    placeholder="Digite o novo material..."
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Diâmetro (mm) - Opcional</label>
                <select 
                  value={form.diameter_mm} 
                  onChange={e => setForm({...form, diameter_mm: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="">Não se aplica / Não medido</option>
                  <option value="50">50 mm</option>
                  <option value="75">75 mm</option>
                  <option value="100">100 mm</option>
                  <option value="150">150 mm</option>
                  <option value="200">200 mm</option>
                  <option value="250">250 mm</option>
                  <option value="300">300 mm</option>
                </select>
              </div>
            </div>
          )}

          {form.category === 'Telemetria' && (
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 animate-in fade-in">
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-1">Qualidade do Sinal</label>
                <select value={telemetrySignal} onChange={e => setTelemetrySignal(e.target.value)} className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="">Selecione...</option>
                  <option value="Bom">Bom</option>
                  <option value="Fraco">Fraco</option>
                  <option value="Sem Sinal">Sem Sinal</option>
                  <option value="Oscilando">Oscilando</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-1">Condição da Antena</label>
                <select value={telemetryAntenna} onChange={e => setTelemetryAntenna(e.target.value)} className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="">Selecione...</option>
                  <option value="OK">OK</option>
                  <option value="Danificada">Danificada</option>
                  <option value="Obstruída">Obstruída</option>
                  <option value="Desalinhada">Desalinhada</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-1">Fonte de Alimentação</label>
                <select value={telemetryPower} onChange={e => setTelemetryPower(e.target.value)} className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="">Selecione...</option>
                  <option value="Rede Elétrica">Rede Elétrica</option>
                  <option value="Energia Solar">Energia Solar</option>
                  <option value="Bateria">Bateria Exclusiva</option>
                </select>
              </div>
            </div>
          )}

          {form.category === 'Inversor' && (
            <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 animate-in fade-in">
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">Tensão Operacional (V)</label>
                <input type="number" step="0.1" value={inverterVoltage} onChange={e => setInverterVoltage(e.target.value)} className="w-full px-4 py-2 bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Ex: 380" />
              </div>
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">Corrente Operacional (A)</label>
                <input type="number" step="0.1" value={inverterCurrent} onChange={e => setInverterCurrent(e.target.value)} className="w-full px-4 py-2 bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Ex: 45.2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">Condição do Painel</label>
                <select value={inverterPanel} onChange={e => setInverterPanel(e.target.value)} className="w-full px-4 py-2 bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none">
                  <option value="">Selecione...</option>
                  <option value="OK">OK</option>
                  <option value="Superaquecimento">Superaquecimento</option>
                  <option value="Sujeira/Poeira">Excesso de Sujeira/Poeira</option>
                  <option value="Infiltração">Infiltração de Água</option>
                </select>
              </div>
            </div>
          )}

          {/* Campos Globais (para todas as categorias exceto Outros) */}
          {form.category !== 'Outros' && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 animate-in fade-in">
              <label className="block text-sm font-semibold text-slate-800 mb-2">Interferências Elétricas (Falta de Fase, Surtos, etc)?</label>
              <select 
                value={form.electrical_interferences} 
                onChange={e => setForm({...form, electrical_interferences: e.target.value})}
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="false">Não</option>
                <option value="true">Sim (Aviso de anomalia reportado)</option>
              </select>
            </div>
          )}

          {/* Influências Naturais com customização */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
             <label className="block text-sm font-semibold text-slate-800 mb-2">Influências Naturais no Local</label>
             <select 
                value={naturalInfluenceSelect} 
                onChange={e => setNaturalInfluenceSelect(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none mb-3"
              >
                <option value="">Nenhuma / Local limpo</option>
                <option value="Presença de vegetação">Presença de vegetação</option>
                <option value="Goteira">Goteira</option>
                <option value="Alta umidade na caixa">Alta umidade na caixa</option>
                <option value="Infiltração grave">Infiltração grave</option>
                <option value="Infestação de insetos/animais">Infestação de insetos/animais</option>
                <option value="Outro">Adicionar nova opção (Outros)...</option>
              </select>

              {naturalInfluenceSelect === 'Outro' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <input 
                    type="text"
                    value={naturalInfluenceCustom}
                    onChange={e => setNaturalInfluenceCustom(e.target.value)}
                    className="w-full px-4 py-2 bg-white border-2 border-primary-400 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none"
                    placeholder="Especifique a influência natural..."
                    required
                  />
                </div>
              )}
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
             <label className="block text-sm font-semibold text-slate-800 mb-2">Houve Substituição de Peças/Equipamentos?</label>
             <select 
                value={replacedPartsBool} 
                onChange={e => setReplacedPartsBool(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none mb-3"
              >
                <option value="false">Não</option>
                <option value="true">Sim, realizei substituição</option>
              </select>

              {replacedPartsBool === 'true' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quais materiais foram substituídos/utilizados?</label>
                  <input 
                    type="text"
                    value={replacedPartsText}
                    onChange={e => setReplacedPartsText(e.target.value)}
                    className="w-full px-4 py-2 bg-white border-2 border-primary-400 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none"
                    placeholder="Ex: modem abs levei e voltou a funcionar, disjuntor trocado..."
                    required
                  />
                </div>
              )}
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
             <div className="flex items-center justify-between mb-3">
               <label className="block text-sm font-semibold text-slate-800">Perguntas Extras Padrões (Treinamento da IA)</label>
               <button type="button" onClick={() => setExtraQuestions([...extraQuestions, {question: '', answer: ''}])} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-md font-bold hover:bg-indigo-200 transition">
                 + Adicionar Pergunta
               </button>
             </div>
             {savedQuestions.length > 0 && (
               <datalist id="saved-questions">
                 {savedQuestions.map((sq, idx) => (
                   <option key={idx} value={sq} />
                 ))}
               </datalist>
             )}

             {extraQuestions.map((eq, idx) => (
                <div key={idx} className="flex gap-2 mb-2 animate-in fade-in slide-in-from-top-1">
                   <input 
                       list="saved-questions"
                       type="text" 
                       placeholder="Pergunta (Ex: Qual pressão local?)" 
                       value={eq.question} 
                       onChange={e => {
                           const newQs = [...extraQuestions];
                           newQs[idx].question = e.target.value;
                           setExtraQuestions(newQs);
                       }} 
                       className="w-1/2 px-3 py-2 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-primary-500 text-sm outline-none" 
                       required 
                   />
                   
                   <input type="text" placeholder="Resposta" value={eq.answer} onChange={e => {
                       const newQs = [...extraQuestions];
                       newQs[idx].answer = e.target.value;
                       setExtraQuestions(newQs);
                   }} className="w-1/2 px-3 py-2 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-primary-500 text-sm outline-none" required />

                   <button type="button" onClick={() => {
                        const newQs = extraQuestions.filter((_, i) => i !== idx);
                        setExtraQuestions(newQs);
                   }} className="text-slate-400 hover:text-red-600 px-2 font-bold transition">X</button>
                </div>
             ))}
             {extraQuestions.length === 0 && <p className="text-xs text-slate-500 italic mt-2">Adicione perguntas que se repetem com frequência. Isso estruturará a base de dados para a IA aprender padrões mais precisos.</p>}
          </div>

          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Outras Anotações Extras (Opcional)</label>
             <textarea 
                value={form.materials_used}
                onChange={e => setForm({...form, materials_used: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none h-24"
                placeholder="Detalhe os reparos abertos, limpezas extras..."
              />
          </div>

          {/* Fotos */}
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Anexar Fotos Opcionais (Antes / Depois)</label>
             <input type="file" multiple className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer" />
           </div>

        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          {loading ? 'Registrando...' : 'Registrar Serviço e Atualizar Status'}
        </button>
      </form>
    </div>
  );
}
