import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ChevronRight, ChevronDown, MapPin, Settings2, Hash, X, FileText, Check, AlertTriangle, Edit2, Plus, Star, PlusCircle, Trash2 } from 'lucide-react';

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

export default function AssetTree() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  
  // Data for Tree View
  const [cities, setCities] = useState<any[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  
  // Data for Table View
  const [panel, setPanel] = useState<BossPanelItem[]>([]);
  const [loadingTable, setLoadingTable] = useState(true);
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [citiesList, setCitiesList] = useState<string[]>([]);

  // State
  const [activeView, setActiveView] = useState<'tree' | 'table'>('tree');
  
  // Asset creation modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({ tag: '', category: 'Poço', system_id: '' });
  const [isCreating, setIsCreating] = useState(false);

  // Detail / Anomaly modal
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [assetHistory, setAssetHistory] = useState<any>(null);
  const [isPreventiveFormOpen, setIsPreventiveFormOpen] = useState(false);
  const [preventiveDesc, setPreventiveDesc] = useState('');
  // Anomaly reporting
  const [isAnomalyFormOpen, setIsAnomalyFormOpen] = useState(false);
  const [anomalyDesc, setAnomalyDesc] = useState('');

  // Date Editing
  const [editingDateId, setEditingDateId] = useState<number | null>(null);
  const [newSvcDate, setNewSvcDate] = useState<string>('');

  const fetchTree = () => {
    setLoadingTree(true);
    api.get('/cities')
      .then(res => setCities(res.data))
      .catch(console.error)
      .finally(() => setLoadingTree(false));
  };

  const fetchTable = () => {
    setLoadingTable(true);
    api.get('/dashboard')
      .then(res => {
        setPanel(res.data.boss_panel);
        const uniqueCities = Array.from(new Set(res.data.boss_panel.map((p: any) => p.city_name))) as string[];
        setCitiesList(uniqueCities);
      })
      .catch(console.error)
      .finally(() => setLoadingTable(false));
  };

  useEffect(() => {
    fetchTree();
    fetchTable();
  }, []);

  useEffect(() => {
    if (selectedAssetId) {
      setIsPreventiveFormOpen(false);
      setIsAnomalyFormOpen(false);
      setAnomalyDesc('');
      setPreventiveDesc('');
      api.get(`/assets/${selectedAssetId}`).then(res => setAssetHistory(res.data)).catch(console.error);
    } else {
      setAssetHistory(null);
    }
  }, [selectedAssetId]);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.system_id || !newAsset.tag) return alert('Preencha os campos obrigatórios');
    setIsCreating(true);
    try {
      await api.post('/assets', {
        tag: newAsset.tag,
        category: newAsset.category,
        system_id: parseInt(newAsset.system_id)
      });
      setIsCreateOpen(false);
      setNewAsset({ tag: '', category: 'Poço', system_id: '' });
      addToast('Novo ativo registrado e adicionado à árvore!', 'success');
      fetchTree(); 
      fetchTable();
    } catch (err) {
      console.error(err);
      addToast('Erro ao criar ativo. Verifique os dados.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handlePriorityChange = async (assetId: number, score: number) => {
    try {
      await api.put(`/assets/${assetId}/priority?score=${score}`);
      addToast('Prioridade operativa do ativo ajustada no Dashboard.', 'info');
      fetchTable();
    } catch (err) {
      console.error('Erro ao atualizar prioridade:', err);
    }
  };

  const handleRequestPreventive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preventiveDesc.trim() || !selectedAssetId) return;
    try {
      await api.post(`/assets/${selectedAssetId}/preventive`, { description: preventiveDesc });
      addToast('Solicitação preventiva enfileirada com sucesso!', 'success');
      setPreventiveDesc('');
      setIsPreventiveFormOpen(false);
      // Fetch latest history
      api.get(`/assets/${selectedAssetId}`).then(res => setAssetHistory(res.data)).catch(console.error);
      fetchTree();
      fetchTable();
    } catch (err) {
      console.error(err);
      addToast('Erro ao solicitar preventiva.', 'error');
    }
  };

  const handleReportAnomaly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anomalyDesc.trim()) return;
    try {
      await api.post(`/assets/${selectedAssetId}/anomaly`, { description: anomalyDesc });
      addToast('Anomalia registrada! A urgência do ativo foi elevada para nível Crítico (Mural KanBan Atualizado).', 'error');
      setIsAnomalyFormOpen(false);
      setAnomalyDesc('');
      // Fetch latest history
      api.get(`/assets/${selectedAssetId}`).then(res => setAssetHistory(res.data)).catch(console.error);
      fetchTree();
      fetchTable();
    } catch (err) {
      console.error(err);
      addToast('Falha técnica ao tentar registrar anomalia de missão crítica.', 'error');
    }
  };

  const handleUpdateServiceDate = async (serviceId: number) => {
    try {
      await api.put(`/services/${serviceId}/date`, { date: newSvcDate });
      setEditingDateId(null);
      // Reload history
      if (selectedAssetId) api.get(`/assets/${selectedAssetId}`).then(res => setAssetHistory(res.data));
      fetchTable();
      addToast('Data atualizada com sucesso', 'success');
    } catch (err) {
      console.error(err);
      addToast('Erro ao atualizar data', 'error');
    }
  };

  const handleDeleteService = async (serviceId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta vistoria? Esta ação não pode ser desfeita.')) return;
    try {
      await api.delete(`/services/${serviceId}`);
      if (selectedAssetId) api.get(`/assets/${selectedAssetId}`).then(res => setAssetHistory(res.data));
      fetchTable();
      addToast('Vistoria excluída com sucesso', 'success');
    } catch (err) {
      console.error(err);
      addToast('Erro ao excluir vistoria', 'error');
    }
  };

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredPanel = cityFilter === 'all' ? panel : panel.filter(p => p.city_name === cityFilter);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          Ativos do NUIAM
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner">
            <button 
              onClick={() => setActiveView('tree')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeView === 'tree' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Árvore de Sistemas
            </button>
            <button 
              onClick={() => setActiveView('table')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeView === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Tabela de Controle
            </button>
          </div>
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors text-sm shadow-sm"
          >
            <Plus size={16} />
            Novo Ativo
          </button>
        </div>
      </div>
      
      {activeView === 'tree' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 animate-in fade-in">
          {loadingTree && cities.length === 0 ? (
            <div className="text-slate-500 text-center py-10">Carregando árvore de ativos...</div>
          ) : (
            <ul className="space-y-4">
              {cities.map(city => {
                const cityKey = `city-${city.id}`;
                const isCityOpen = expandedNodes[cityKey];
                return (
                  <li key={cityKey} className="ml-2 border-l-2 border-slate-200 pl-4 py-1">
                    <div 
                      className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors"
                      onClick={() => toggleNode(cityKey)}
                    >
                      {isCityOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                      <MapPin size={20} className="text-primary-600" />
                      <span className="font-bold text-slate-800 text-lg">{city.name}</span>
                    </div>

                    {isCityOpen && (
                      <ul className="mt-2 space-y-2">
                        {city.systems.map((sys: any) => {
                          const sysKey = `sys-${sys.id}`;
                          const isSysOpen = expandedNodes[sysKey];
                          return (
                            <li key={sysKey} className="ml-6 border-l-2 border-slate-200 pl-4 py-1">
                              <div 
                                className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors"
                                onClick={() => toggleNode(sysKey)}
                              >
                                {isSysOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                                <Settings2 size={18} className="text-indigo-600" />
                                <span className="font-semibold text-slate-700">{sys.name}</span>
                              </div>

                              {isSysOpen && (
                                <ul className="mt-2 space-y-2">
                                  {sys.assets.map((asset: any) => {
                                    const assetKey = `ast-${asset.id}`;
                                    const colorClass = asset.status === 'Critico' ? 'text-red-600 bg-red-50 border-red-200' :
                                                      asset.status === 'Preventiva' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                                                      'text-green-600 bg-green-50 border-green-200';

                                    return (
                                      <li key={assetKey} className="ml-8 py-1">
                                        <div 
                                          className={`flex items-center gap-3 p-3 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-all ${colorClass}`}
                                          onClick={() => setSelectedAssetId(asset.id)}
                                        >
                                          <Hash size={18} />
                                          <div className="flex-1">
                                            <p className="font-bold">{asset.tag}</p>
                                            <p className="text-xs opacity-90">{asset.category} • Última manutenção: {asset.last_maintenance ? asset.last_maintenance.split('T')[0].split('-').reverse().join('/') : ''}</p>
                                          </div>
                                          <span className="text-xs font-bold uppercase tracking-widest px-2 py-1 bg-white/50 rounded-md shadow-sm">
                                            {asset.status}
                                          </span>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
              {cities.length === 0 && (
                <div className="text-slate-500">Nenhum ativo encontrado na árvore.</div>
              )}
            </ul>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="font-bold text-slate-700">Tabela de Controle Operacional</span>
            <div className="flex items-center gap-2">
               <span className="text-sm font-medium text-slate-600">Filtrar por Sistema:</span>
               <select 
                 value={cityFilter}
                 onChange={e => setCityFilter(e.target.value)}
                 className="bg-white border text-sm border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
               >
                 <option value="all">Todos os Sistemas</option>
                 {citiesList.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            </div>
          </div>
          {loadingTable ? (
            <div className="text-slate-500 text-center py-10">Carregando ativos em tabela...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioridade</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tag</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoria</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subsistema (Sistema)</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Última Manut.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPanel.map((item) => (
                    <tr 
                      key={item.id} 
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedAssetId(item.id)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1" onClick={(e) => { e.stopPropagation(); }}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              type="button"
                              key={star}
                              disabled={user?.role !== 'chefe' && user?.role !== 'desenvolvedor'}
                              onClick={() => handlePriorityChange(item.id, star === item.priority_score ? 0 : star)}
                              className={`${user?.role === 'chefe' || user?.role === 'desenvolvedor' ? 'hover:scale-110 active:scale-95 transition-transform' : 'cursor-default opacity-70'} focus:outline-none`}
                            >
                              <Star 
                                size={16} 
                                className={`${star <= (item.priority_score || 0) ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-slate-300'}`} 
                              />
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                          ${item.criticality === 3 ? 'bg-red-100 text-red-800 border bg-opacity-70 border-red-200' : 
                            item.criticality === 2 ? 'bg-yellow-100 text-yellow-800 border bg-opacity-70 border-yellow-200' : 
                            'bg-green-100 text-green-800 border bg-opacity-70 border-green-200'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">{item.tag}</td>
                      <td className="py-3 px-4 text-slate-600">{item.category}</td>
                      <td className="py-3 px-4 text-slate-600">{item.system_name} ({item.city_name})</td>
                      <td className="py-3 px-4 text-slate-500">{item.last_maintenance ? item.last_maintenance.split('T')[0].split('-').reverse().join('/') : ''}</td>
                    </tr>
                  ))}
                  {filteredPanel.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">Nenhum ativo encontrado nesta localidade.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 tracking-tight">Novo Ativo</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateAsset} className="p-4 space-y-4 bg-white">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tag (Identificação)</label>
                <input 
                  type="text"
                  value={newAsset.tag}
                  onChange={e => setNewAsset({...newAsset, tag: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  placeholder="Ex: PT-11"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria do Ativo</label>
                <select 
                  value={newAsset.category}
                  onChange={e => setNewAsset({...newAsset, category: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="Poço">Poço</option>
                  <option value="Elevatória">Elevatória</option>
                  <option value="Reservatório">Reservatório</option>
                  <option value="Válvula">Válvula</option>
                  <option value="Captação">Captação</option>
                  <option value="Inversor">Inversor</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sistema Pai (Onde está instalado?)</label>
                <select 
                  value={newAsset.system_id}
                  onChange={e => setNewAsset({...newAsset, system_id: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  required
                >
                  <option value="">Selecione o Sistema...</option>
                  {cities.map(c => c.systems.map((sys: any) => (
                    <option key={sys.id} value={sys.id}>{sys.name} ({c.name})</option>
                  )))}
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isCreating ? 'Criando...' : 'Criar Ativo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES E HISTÓRICO DO ATIVO */}
      {selectedAssetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                  <Hash size={24} className="text-primary-600"/>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                    {assetHistory ? `Ativo: ${assetHistory.tag}` : 'Carregando...'}
                  </h3>
                  {assetHistory && <p className="text-sm font-medium text-slate-500">{assetHistory.category}</p>}
                </div>
              </div>
              <button 
                onClick={() => setSelectedAssetId(null)}
                className="p-2 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Body Modal */}
            <div className="p-6 overflow-y-auto flex-1 bg-white">
              {!assetHistory ? (
                <div className="text-center text-slate-500 my-10 animate-pulse">Consultando ficha do equipamento...</div>
              ) : (
                <div className="space-y-8">
                  {/* BARRA DE AÇÕES RÁPIDAS (NOVO FORMATO) */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-center justify-center sm:justify-start">
                    <button 
                      onClick={() => navigate(`/service?asset=${assetHistory.id}`)}
                      className="flex-1 min-w-[200px] bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <PlusCircle size={18} />
                      Registrar Vistoria Normal
                    </button>
                    <button 
                      onClick={() => { setIsAnomalyFormOpen(false); setIsPreventiveFormOpen(!isPreventiveFormOpen); }}
                      className="flex-1 min-w-[200px] bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 text-yellow-700 px-4 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <Settings2 size={18} />
                      Pedir Preventiva
                    </button>
                    <button 
                      onClick={() => { setIsPreventiveFormOpen(false); setIsAnomalyFormOpen(!isAnomalyFormOpen); }}
                      className="flex-1 min-w-[200px] border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-sm relative overflow-hidden"
                    >
                      <AlertTriangle size={18} />
                      Reportar Anomalia Urgente
                    </button>
                  </div>

                  {/* FORM DE PREVENTIVA */}
                  {isPreventiveFormOpen && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-6 shadow-sm animate-in fade-in slide-in-from-top-4">
                      <h4 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
                        <Settings2 size={18} /> Solicitar Manutenção Preventiva
                      </h4>
                      <p className="text-yellow-800 text-sm mb-4">Esta ação moverá o ativo automaticamente para a coluna "A Fazer" com prioridade amarela de revisão.</p>
                      
                      <form onSubmit={handleRequestPreventive} className="space-y-3">
                        <textarea 
                          required
                          placeholder="Detalhe os motivos para requisitar preventiva neste equipamento (Ex: Tempo de uso, trepidação percebida)..."
                          rows={3}
                          className="w-full border border-yellow-200 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                          value={preventiveDesc}
                          onChange={e => setPreventiveDesc(e.target.value)}
                        />
                        <button type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2.5 rounded-lg font-bold w-full transition-colors flex items-center justify-center gap-2">
                           <Settings2 size={18} />
                           Registrar Alerta Amarelo
                        </button>
                      </form>
                    </div>
                  )}

                  {/* FORM DE ANOMALIA URGENTE */}
                  {isAnomalyFormOpen && (
                    <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5 mb-6 shadow-sm animate-in fade-in slide-in-from-top-4 relative overflow-hidden">
                      <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
                        <AlertTriangle size={150}/>
                      </div>
                      <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2 relative z-10">
                        <AlertTriangle size={20} /> Relatar Falha Operacional Crítica
                      </h4>
                      <p className="text-red-800 text-sm mb-4 relative z-10">Caso este equipamento tenha parado de responder, utilize este registro rápido (Ex: "Vazão zero reportada pela Telemetria"). A prioridade do ativo subirá para urgência máxima e ele será inserido automaticamente no quadro de Kanban como Próxima Demanda.</p>
                      
                      <form onSubmit={handleReportAnomaly} className="space-y-3 relative z-10">
                        <div>
                          <textarea 
                            required
                            placeholder="Descreva a emergência ou erro (ex: Bomba desligou, comunicação perdida, vazão marcando 0 l/s)"
                            rows={3}
                            className="w-full border-2 border-red-200 bg-white p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-800 placeholder-slate-400 font-medium resize-none shadow-inner"
                            value={anomalyDesc}
                            onChange={e => setAnomalyDesc(e.target.value)}
                          />
                        </div>
                        <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-bold w-full transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md">
                          <AlertTriangle size={18}/> Salvar Anomalia no Histórico e Acionar Alarme
                        </button>
                      </form>
                    </div>
                  )}

                  <div>
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
                      <FileText size={20} className="text-slate-400" /> Histórico de Vida do Ativo
                    </h4>
                    
                    {assetHistory.services.length === 0 ? (
                      <p className="text-slate-500 bg-slate-50 p-6 rounded-xl border border-slate-100 text-center font-medium">Nenhuma manutenção ou anomalia registrada no histórico.</p>
                    ) : (
                      <div className="space-y-4">
                        {assetHistory.services.map((svc: any) => (
                          <div key={svc.id} className={`border rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${svc.materials_used?.includes('[ALERTA VERMELHO') ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}>
                            {svc.materials_used?.includes('[ALERTA VERMELHO') && (
                              <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                            )}
                            <div className="flex justify-between items-start mb-3">
                              <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider shadow-sm border ${
                                svc.macro_type === 'Preventiva' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                svc.macro_type === 'Corretiva' ? 'bg-red-50 text-red-700 border-red-200' : 
                                'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {svc.macro_type}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-500 mr-2">
                                  {svc.date ? svc.date.split('T')[0].split('-').reverse().join('/') : ''}
                                </span>
                                <button 
                                  onClick={() => navigate(`/service?edit_id=${svc.id}&asset=${assetHistory.id}`)}
                                  className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-slate-50 rounded transition-colors border border-transparent hover:border-slate-200"
                                  title="Editar Vistoria Completa"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteService(svc.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors border border-transparent hover:border-red-200"
                                  title="Excluir Vistoria"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-2 mt-3 text-sm text-slate-700">
                               <p><strong className="text-slate-900 font-semibold">Tipo Geral:</strong> {svc.category}</p>
                               
                               {svc.piping_material && <p><strong className="text-slate-900 font-semibold">Intervenção na Linha:</strong> {svc.piping_material} {svc.diameter_mm ? `(${svc.diameter_mm}mm)` : ''}</p>}
                               
                               {svc.natural_influences && <p><strong className="text-slate-900 font-semibold">Causas ou Clima:</strong> {svc.natural_influences}</p>}
                               
                               {svc.replaced_parts && (
                                  <p className="bg-yellow-50/50 text-yellow-900 p-3 rounded-lg border border-yellow-200 mt-2 font-medium">
                                    <strong className="block text-yellow-800 mb-1">Peças Substituídas:</strong> {svc.replaced_parts}
                                  </p>
                               )}
                               
                               {svc.users && svc.users.length > 0 && (
                                  <p className="bg-slate-50 p-2.5 rounded-lg text-slate-700 mt-2 border border-slate-200 flex items-center gap-2">
                                    <strong className="text-slate-900">Responsável:</strong> {svc.users.map((u: any) => u.full_name).join(', ')}
                                  </p>
                               )}
                               
                               {svc.materials_used && !svc.materials_used.includes('[ALERTA VERMELHO') && (
                                  <p className="bg-slate-50 p-3 rounded-lg text-slate-700 mt-3 border border-slate-200">
                                    <strong className="block mb-1 text-slate-900">Observações:</strong> {svc.materials_used}
                                  </p>
                               )}
                               
                               {/* Renderização especial para mensagens de Erro Crítico (Anomalia) */}
                               {svc.materials_used && svc.materials_used.includes('[ALERTA VERMELHO') && (
                                  <div className="bg-red-100 text-red-900 px-4 py-3 rounded-lg mt-3 border border-red-200 font-medium">
                                    {svc.materials_used}
                                  </div>
                               )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
