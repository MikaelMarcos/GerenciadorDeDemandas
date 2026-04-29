import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Settings2, AlertTriangle, Activity, Clock, CheckCircle, FileText, Check, X, Edit2, Star, PlusCircle } from 'lucide-react';

interface DashboardSummary {
  green: number;
  yellow: number;
  red: number;
  total: number;
}

interface BossPanelItem {
  id: number;
  tag: string;
  category: string;
  system_name: string;
  city_name: string;
  status: string;
  last_maintenance: string;
  criticality: number;
  priority_score: number;
  kanban_status: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  useAuth();
  const { addToast } = useToast();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [panel, setPanel] = useState<BossPanelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [assetHistory, setAssetHistory] = useState<any>(null);
  
  const [draggedItemId, setDraggedItemId] = useState<number | null>(null);

  // Filtros
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [citiesList, setCitiesList] = useState<string[]>([]);
  
  // Preventiva
  const [isPreventiveFormOpen, setIsPreventiveFormOpen] = useState(false);
  const [preventiveDesc, setPreventiveDesc] = useState('');

  // Anomalia
  const [isAnomalyFormOpen, setIsAnomalyFormOpen] = useState(false);
  const [anomalyDesc, setAnomalyDesc] = useState('');

  // Date Editing
  const [editingDateId, setEditingDateId] = useState<number | null>(null);
  const [newSvcDate, setNewSvcDate] = useState<string>('');

  const fetchDashboard = () => {
    api.get('/dashboard')
      .then(res => {
        setSummary(res.data.summary);
        setPanel(res.data.boss_panel);
        
        // Extrai as cidades únicas para o filtro
        const uniqueCities = Array.from(new Set(res.data.boss_panel.map((p: any) => p.city_name))) as string[];
        setCitiesList(uniqueCities);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (selectedAssetId) {
      setIsPreventiveFormOpen(false);
      setIsAnomalyFormOpen(false);
      setPreventiveDesc('');
      setAnomalyDesc('');
      api.get(`/assets/${selectedAssetId}`).then(res => setAssetHistory(res.data)).catch(console.error);
    } else {
      setAssetHistory(null);
    }
  }, [selectedAssetId]);

  const handleRequestPreventive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preventiveDesc.trim() || !selectedAssetId) return;
    try {
      await api.post(`/assets/${selectedAssetId}/preventive`, { description: preventiveDesc });
      addToast('Solicitação preventiva enfileirada com sucesso!', 'success');
      setPreventiveDesc('');
      setIsPreventiveFormOpen(false);
      // Refresh asset details
      api.get(`/assets/${selectedAssetId}`).then(res => setAssetHistory(res.data)).catch(console.error);
      fetchDashboard();
    } catch (err) {
      console.error(err);
      addToast('Erro ao solicitar preventiva', 'error');
    }
  };

  const handleReportAnomaly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anomalyDesc.trim() || !selectedAssetId) return;
    try {
      await api.post(`/assets/${selectedAssetId}/anomaly`, { description: anomalyDesc });
      addToast('Anomalia registrada! A urgência do ativo foi elevada para nível Crítico (Mural KanBan Atualizado).', 'error');
      setIsAnomalyFormOpen(false);
      setAnomalyDesc('');
      api.get(`/assets/${selectedAssetId}`).then(res => setAssetHistory(res.data)).catch(console.error);
      fetchDashboard(); 
    } catch (err) {
      console.error(err);
      addToast('Falha técnica ao tentar registrar anomalia de missão crítica.', 'error');
    }
  };

  const handleUpdateServiceDate = async (svcId: number) => {
    try {
      await api.put(`/services/${svcId}/date`, { date: newSvcDate });
      addToast('Data do serviço atualizada com sucesso!', 'success');
      setEditingDateId(null);
      if (selectedAssetId) {
        api.get(`/assets/${selectedAssetId}`).then(res => setAssetHistory(res.data)).catch(console.error);
      }
      fetchDashboard();
    } catch (err) {
      addToast('Erro ao atualizar a data.', 'error');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Carregando painel...</div>;

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Visual tweak para o elemento sendo arrastado
    setTimeout(() => {
      if (e.target instanceof HTMLElement) e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedItemId(null);
    if (e.target instanceof HTMLElement) e.target.style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (!draggedItemId) return;

    const assetId = draggedItemId;
    const originalPanel = [...panel];
    const assetToUpdate = originalPanel.find(p => p.id === assetId);
    const oldStatus = assetToUpdate?.kanban_status || 'backlog'; // Default to 'backlog' if not set

    // Atualiza local imediatamente para fluidez
    setPanel(prev => prev.map(p => p.id === assetId ? { ...p, kanban_status: newStatus } : p));

    // Chama API para persistir localmente
    try {
      await api.put(`/assets/${assetId}/kanban?status=${newStatus}`);
      
      // Encontra a tag do ativo para a mensagem do toast
      const assetObj = panel.find(p => p.id === assetId);
      if (assetObj && oldStatus !== newStatus) {
        addToast(`Ativo ${assetObj.tag} movido para a nova etapa!`, 'success');
      }
      
      fetchDashboard(); 
    } catch (err) {
      console.error('Erro ao atualizar kanban:', err);
      addToast('Erro ao atualizar kanban.', 'error');
      // Reverte se der erro
      setPanel(originalPanel);
    }
    setDraggedItemId(null);
  };

  const filteredPanel = cityFilter === 'all' ? panel : panel.filter(p => p.city_name === cityFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Visão Geral NUIAM</h1>
        <div className="flex items-center gap-2">
           <span className="text-sm font-medium text-slate-600">Filtrar por Sistema:</span>
           <select 
             value={cityFilter}
             onChange={e => setCityFilter(e.target.value)}
             className="bg-white border text-sm border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
           >
             <option value="all">Todos os Sistemas</option>
             {citiesList.map(c => <option key={c} value={c}>{c}</option>)}
           </select>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium tracking-wide">TOTAL ATIVOS</p>
            <p className="text-3xl font-bold text-slate-800">{summary?.total || 0}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-center gap-4 border-l-4 border-l-red-500">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium tracking-wide">CRÍTICOS</p>
            <p className="text-3xl font-bold text-slate-800">{summary?.red || 0}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-center gap-4 border-l-4 border-l-yellow-500">
          <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium tracking-wide">PREVENTIVA</p>
            <p className="text-3xl font-bold text-slate-800">{summary?.yellow || 0}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-center gap-4 border-l-4 border-l-green-500">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-500">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium tracking-wide">OPERACIONAL</p>
            <p className="text-3xl font-bold text-slate-800">{summary?.green || 0}</p>
          </div>
        </div>
      </div>
      {/* Quadro Kanban */}
      <div className="flex items-center justify-between mt-8 mb-4">
        <h2 className="text-xl font-bold text-slate-800">Quadro de Demandas Diárias (Kanban)</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in">
        {[
            { id: 'backlog', title: 'Todos os Ativos', icon: <FileText size={18}/>, color: 'bg-slate-100', border: 'border-slate-200' },
            { id: 'todo', title: 'Próximas Demandas', icon: <Clock size={18}/>, color: 'bg-amber-50', border: 'border-amber-200' },
            { id: 'in_progress', title: 'Em Execução', icon: <Activity size={18}/>, color: 'bg-blue-50', border: 'border-blue-200' },
            { id: 'done', title: 'Concluído', icon: <CheckCircle size={18}/>, color: 'bg-emerald-50', border: 'border-emerald-200' }
          ].map(col => (
            <div 
              key={col.id}
              className={`${col.color} rounded-xl border ${col.border} p-4 flex flex-col min-h-[500px] transition-colors`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
                <h3 className="font-bold flex items-center gap-2 text-slate-700">
                  {React.cloneElement(col.icon, { className: 'text-slate-500' })}
                  {col.title}
                </h3>
                <span className="bg-white/60 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full border border-black/5">
                  {filteredPanel.filter(p => p.kanban_status === col.id || (!p.kanban_status && col.id === 'backlog')).length}
                </span>
              </div>
              
              <div className="flex-1 space-y-3">
                {filteredPanel
                  .filter(p => p.kanban_status === col.id || (!p.kanban_status && col.id === 'backlog'))
                  .map(item => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedAssetId(item.id)}
                      className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group relative"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-slate-800 group-hover:text-primary-600 transition-colors">{item.tag}</span>
                        <div className="flex">
                           {[1, 2, 3].map(s => (
                             <Star 
                               key={s} 
                               size={12} 
                               className={`${s <= (item.priority_score || 0) ? 'fill-amber-400 text-amber-400' : 'hidden'}`} 
                             />
                           ))}
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 mb-1">{item.category}</p>
                      <div className="flex items-center justify-between mt-3 text-xs">
                        <span className="text-slate-500 truncate max-w-[120px]">{item.system_name}</span>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${item.criticality === 3 ? 'bg-red-100 text-red-700' : item.criticality === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                          {item.status === 'Critico' ? 'Crítico' : item.status === 'Preventiva' ? 'Vencido' : 'OK'}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
      </div>

      {/* MODAL DE HISTÓRICO DO ATIVO */}
      {selectedAssetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                  {assetHistory ? `Ativo: ${assetHistory.tag}` : 'Carregando...'}
                </h3>
                {assetHistory && <p className="text-sm text-slate-500">{assetHistory.category}</p>}
              </div>
              <button 
                onClick={() => setSelectedAssetId(null)}
                className="p-2 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Body Modal */}
            <div className="p-6 overflow-y-auto flex-1 bg-white">
              {!assetHistory ? (
                <div className="text-center text-slate-500 my-10">Buscando histórico...</div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4 mb-6 pb-6 border-b border-slate-100">
                    <button 
                      onClick={() => navigate(`/service?asset=${assetHistory.id}`)}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
                    >
                      <PlusCircle size={18} />
                      Nova Vistoria neste Ativo
                    </button>
                    <button 
                      onClick={() => setIsPreventiveFormOpen(!isPreventiveFormOpen)}
                      className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors border border-yellow-200 w-full sm:w-auto"
                    >
                      <Settings2 size={18} />
                      Pedir Preventiva
                    </button>
                    <button 
                      onClick={() => setIsAnomalyFormOpen(!isAnomalyFormOpen)}
                      className="bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors border border-red-200 w-full sm:w-auto"
                    >
                      <AlertTriangle size={18} />
                      Reportar Anomalia Urgente
                    </button>
                  </div>

                  {isAnomalyFormOpen && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6 shadow-sm animate-in fade-in slide-in-from-top-4">
                      <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                        <AlertTriangle size={18} /> Relatar Anomalia (Vazão Zero, Queda, etc)
                      </h4>
                      <p className="text-red-800 text-sm mb-4">Atenção: Relatar uma anomalia alterará o ativo para Crítico e o devolverá para as Próximas Demandas no Kanban.</p>
                      <form onSubmit={handleReportAnomaly} className="space-y-3">
                        <textarea 
                          required
                          placeholder="Descreva o problema encontrado (Ex: Bomba desarmada e com vazão zero)..."
                          rows={3}
                          className="w-full border border-red-200 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                          value={anomalyDesc}
                          onChange={e => setAnomalyDesc(e.target.value)}
                        />
                        <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold w-full transition-colors">
                          Registrar Alerta Vermelho
                        </button>
                      </form>
                    </div>
                  )}

                  {isPreventiveFormOpen && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-6 shadow-sm animate-in fade-in slide-in-from-top-4">
                      <h4 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
                        <Settings2 size={18} /> Solicitar Manutenção Preventiva
                      </h4>
                      <p className="text-yellow-800 text-sm mb-4">Esta ação moverá o ativo para a coluna "A Fazer" com prioridade amarela de revisão.</p>
                      
                      <form onSubmit={handleRequestPreventive} className="space-y-3">
                        <textarea 
                          required
                          placeholder="Detalhe o motivo para requisitar preventiva (Ex: Tempo de uso, trepidação percebida)..."
                          rows={3}
                          className="w-full border border-yellow-200 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                          value={preventiveDesc}
                          onChange={e => setPreventiveDesc(e.target.value)}
                        />
                        <button type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold w-full transition-colors flex items-center justify-center gap-2">
                           <Settings2 size={18} />
                           Registrar Alerta Amarelo
                        </button>
                      </form>
                    </div>
                  )}

                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-slate-400" /> Histórico de Intervenções
                  </h4>
                  
                  {assetHistory.services.length === 0 ? (
                    <p className="text-slate-500 bg-slate-50 p-4 rounded-lg border border-slate-100">Nenhuma manutenção registrada para este ativo.</p>
                  ) : (
                    <div className="space-y-4">
                      {assetHistory.services.map((svc: any) => (
                        <div key={svc.id} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${svc.macro_type === 'Preventiva' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                              {svc.macro_type}
                            </span>
                            <div className="flex items-center gap-2">
                              {editingDateId === svc.id ? (
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="date" 
                                    value={newSvcDate} 
                                    onChange={e => setNewSvcDate(e.target.value)}
                                    className="border border-slate-300 rounded px-2 py-0.5 text-sm"
                                  />
                                  <button onClick={() => handleUpdateServiceDate(svc.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                    <Check size={16} />
                                  </button>
                                  <button onClick={() => setEditingDateId(null)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                    <X size={16} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-sm font-medium text-slate-500">
                                    {svc.date ? svc.date.split('T')[0].split('-').reverse().join('/') : ''}
                                  </span>
                                  <button 
                                    onClick={() => { setEditingDateId(svc.id); setNewSvcDate(svc.date); }}
                                    className="p-1 text-slate-400 hover:text-primary-600 hover:bg-slate-50 rounded transition-colors"
                                    title="Editar Data"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2 mt-3 text-sm text-slate-700">
                             <p><strong className="text-slate-900">Tipo:</strong> {svc.category}</p>
                             <p><strong className="text-slate-900">Tubulação:</strong> {svc.piping_material} {svc.diameter_mm && `(${svc.diameter_mm}mm)`}</p>
                             {svc.natural_influences && <p><strong className="text-slate-900">Influência Natural:</strong> {svc.natural_influences}</p>}
                             {svc.replaced_parts && (
                                <p className="bg-yellow-50 text-yellow-900 p-2 rounded border border-yellow-200 mt-2">
                                  <strong>Peças Trocadas/Materiais:</strong> {svc.replaced_parts}
                                </p>
                             )}
                             {svc.users && svc.users.length > 0 && (
                                <p className="bg-slate-100 p-2 rounded text-slate-700 mt-2 border border-slate-200">
                                  <strong>Técnicos:</strong> {svc.users.map((u: any) => u.full_name).join(', ')}
                                </p>
                             )}
                             {svc.materials_used && (
                                <p className="bg-slate-50 p-2 rounded text-slate-600 mt-2 border border-slate-100">
                                  <strong>Anotações Extras:</strong> {svc.materials_used}
                                </p>
                             )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
