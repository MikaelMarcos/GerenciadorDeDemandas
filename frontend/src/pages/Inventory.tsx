import React, { useState, useEffect } from 'react';
import { Package, Plus, AlertCircle, Search, ArrowDownToLine, ArrowUpFromLine, FileDown, Edit2, Trash2, History } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import api from '../api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface InventoryItem {
  id: number;
  name: string;
  current_quantity: number;
  unit?: string;
  price?: number;
  serial_number?: string;
  asset_tag?: string;
  model?: string;
  observations?: string;
  min_stock_limit: number;
}

interface InventoryMovement {
  id: number;
  item_id: number;
  movement_type: 'in' | 'out';
  quantity: number;
  responsible_name: string;
  date: string;
  observation?: string;
}

export default function Inventory() {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isItemModalOpen, setItemModalOpen] = useState(false);
  const [isMovementModalOpen, setMovementModalOpen] = useState(false);
  const [isHistoryModalOpen, setHistoryModalOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  
  const [movementsHistory, setMovementsHistory] = useState<InventoryMovement[]>([]);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    current_quantity: '0' as string | number,
    unit: '',
    price: '' as string | number,
    serial_number: '',
    asset_tag: '',
    model: '',
    observations: '',
    min_stock_limit: '2' as string | number
  });

  const [isSaving, setIsSaving] = useState(false);

  const [movementData, setMovementData] = useState({
    quantity: 1,
    observation: ''
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/inventory');
      setItems(response.data);
    } catch (error) {
      addToast('Erro ao carregar estoque.', 'error');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatus = (item: InventoryItem) => {
    if (item.current_quantity === 0) return { label: 'Em falta', color: 'bg-red-100 text-red-800', dot: 'bg-red-500' };
    if (item.current_quantity <= item.min_stock_limit) return { label: 'Baixo estoque', color: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' };
    return { label: 'Normal', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' };
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.asset_tag && item.asset_tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const outOfStockCount = items.filter(i => i.current_quantity === 0).length;
  const lowStockCount = items.filter(i => i.current_quantity > 0 && i.current_quantity <= i.min_stock_limit).length;

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        price: formData.price !== '' && formData.price !== null && !isNaN(Number(formData.price)) ? Number(formData.price) : null,
        current_quantity: formData.current_quantity !== '' && formData.current_quantity !== null && !isNaN(Number(formData.current_quantity)) ? Number(formData.current_quantity) : 0,
        min_stock_limit: formData.min_stock_limit !== '' && formData.min_stock_limit !== null && !isNaN(Number(formData.min_stock_limit)) ? Number(formData.min_stock_limit) : 0,
      };

      if (editingItem) {
        await api.put(`/inventory/${editingItem.id}`, payload);
        addToast('Item atualizado com sucesso!', 'success');
      } else {
        await api.post('/inventory', payload);
        addToast('Item adicionado com sucesso!', 'success');
      }
      setItemModalOpen(false);
      fetchItems();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const errorMsg = Array.isArray(detail) ? detail[0].msg : (typeof detail === 'string' ? detail : 'Erro ao salvar item.');
      addToast(errorMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementItem) return;
    try {
      await api.post(`/inventory/${movementItem.id}/movement`, {
        movement_type: movementType,
        quantity: movementData.quantity,
        observation: movementData.observation
      }, {
        params: { user_name: user?.full_name }
      });
      addToast('Movimentação registrada!', 'success');
      setMovementModalOpen(false);
      fetchItems();
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Erro na movimentação.', 'error');
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este material e todo o seu histórico de movimentações?')) return;
    try {
      await api.delete(`/inventory/${id}`);
      addToast('Item excluído!', 'success');
      fetchItems();
    } catch (error) {
      addToast('Erro ao excluir item.', 'error');
    }
  };

  const openHistory = async (item: InventoryItem) => {
    try {
      const response = await api.get(`/inventory/${item.id}/movements`);
      setMovementsHistory(response.data);
      setEditingItem(item); // Just using to hold reference for title
      setHistoryModalOpen(true);
    } catch (error) {
      addToast('Erro ao carregar histórico.', 'error');
    }
  };

  const generateReport = async () => {
    try {
      const movementsRes = await api.get('/inventory/movements/all');
      const allMovements: InventoryMovement[] = movementsRes.data;

      const doc = new jsPDF();
      
      // Page 1: Summary
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("Relatório de Almoxarifado NUIAM", 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
      doc.text(`Responsável: ${user?.full_name}`, 14, 36);

      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text("Resumo da Posição Atual", 14, 50);

      doc.setFontSize(12);
      doc.text(`Total de Itens Cadastrados: ${items.length}`, 14, 60);
      doc.text(`Total de Peças em Estoque: ${items.reduce((acc, curr) => acc + curr.current_quantity, 0)}`, 14, 68);

      const criticalItems = items.filter(i => i.current_quantity <= i.min_stock_limit);
      const missingItems = criticalItems.filter(i => i.current_quantity === 0);
      const lowItems = criticalItems.filter(i => i.current_quantity > 0);

      doc.setFontSize(14);
      doc.setTextColor(220, 38, 38); // red-600
      doc.text("Atenção Crítica: Itens em Falta (Estoque Zerado)", 14, 85);
      
      if (missingItems.length > 0) {
        (doc as any).autoTable({
          startY: 90,
          head: [['Item', 'Limite de Alerta']],
          body: missingItems.map(i => [i.name, i.min_stock_limit]),
          theme: 'grid',
          headStyles: { fillColor: [239, 68, 68] },
          styles: { fontSize: 10 }
        });
      } else {
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("Nenhum item em falta no momento.", 14, 92);
      }

      let nextY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 105;

      doc.setFontSize(14);
      doc.setTextColor(234, 88, 12); // orange-600
      doc.text("Atenção: Itens com Baixo Estoque", 14, nextY);

      if (lowItems.length > 0) {
        (doc as any).autoTable({
          startY: nextY + 5,
          head: [['Item', 'Qtd Atual', 'Limite de Alerta']],
          body: lowItems.map(i => [i.name, i.current_quantity, i.min_stock_limit]),
          theme: 'grid',
          headStyles: { fillColor: [249, 115, 22] },
          styles: { fontSize: 10 }
        });
      } else {
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("Nenhum item em baixo estoque no momento.", 14, nextY + 7);
      }

      // Page 2: Complete List
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text("Posição Completa do Estoque", 14, 22);

      (doc as any).autoTable({
        startY: 30,
        head: [['Material', 'Qtd', 'Unidade', 'Preço (R$)', 'Total (R$)']],
        body: items.map(i => [
          i.name, 
          i.current_quantity, 
          i.unit || '-', 
          i.price ? i.price.toFixed(2) : '-',
          i.price ? (i.price * i.current_quantity).toFixed(2) : '-'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 9 }
      });

      // Page 3: Movements History
      if (allMovements.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.text("Histórico de Movimentações", 14, 22);

        (doc as any).autoTable({
          startY: 30,
          head: [['Data', 'Material', 'Tipo', 'Qtd', 'Responsável', 'Obs']],
          body: allMovements.map(m => {
            const item = items.find(i => i.id === m.item_id);
            return [
              new Date(m.date).toLocaleDateString('pt-BR'),
              item ? item.name : `Item #${m.item_id}`,
              m.movement_type === 'in' ? 'Entrada' : 'Saída',
              m.quantity,
              m.responsible_name,
              m.observation || '-'
            ];
          }),
          theme: 'striped',
          headStyles: { fillColor: [71, 85, 105] },
          styles: { fontSize: 8 }
        });
      }

      doc.save("Relatorio_Almoxarifado_NUIAM.pdf");
      addToast('Relatório gerado com sucesso!', 'success');
    } catch (error) {
      addToast('Erro ao gerar relatório.', 'error');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="text-primary-600" /> Estoque / Almoxarifado
          </h1>
          <p className="text-slate-500">Controle de materiais técnicos e eletrônicos.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generateReport}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 font-medium shadow-sm"
          >
            <FileDown size={18} /> Relatório PDF
          </button>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({ name: '', current_quantity: '0', unit: '', price: '', serial_number: '', asset_tag: '', model: '', observations: '', min_stock_limit: '2' });
              setItemModalOpen(true);
            }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 font-medium shadow-sm shadow-primary-500/20"
          >
            <Plus size={18} /> Novo Material
          </button>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Package size={20} className="text-slate-400"/> Total de Tipos de Materiais
          </div>
          <div className="text-3xl font-bold text-slate-800">{items.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertCircle size={64} className="text-orange-500" />
          </div>
          <div className="flex items-center gap-3 text-orange-600 mb-2 font-medium">
            <AlertCircle size={20} /> Baixo Estoque
          </div>
          <div className="text-3xl font-bold text-slate-800">{lowStockCount}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertCircle size={64} className="text-red-500" />
          </div>
          <div className="flex items-center gap-3 text-red-600 mb-2 font-medium">
            <AlertCircle size={20} /> Em Falta
          </div>
          <div className="text-3xl font-bold text-slate-800">{outOfStockCount}</div>
        </div>
      </div>

      {/* List Area */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-4 bg-slate-50/50">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Qtd</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden md:table-cell">Modelo/Tomb.</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Carregando estoque...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Nenhum material encontrado.</td></tr>
              ) : (
                filteredItems.map(item => {
                  const status = getStatus(item);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-400">{item.unit || 'unidade(s)'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-slate-800 text-lg">{item.current_quantity}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell text-slate-500">
                        {item.model && <div>Mod: {item.model}</div>}
                        {item.asset_tag && <div>Tomb: {item.asset_tag}</div>}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setMovementItem(item); setMovementType('in'); setMovementData({ quantity: 1, observation: ''}); setMovementModalOpen(true); }}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors" title="Adicionar ao Estoque"
                          >
                            <ArrowUpFromLine size={18} />
                          </button>
                          <button
                            onClick={() => { setMovementItem(item); setMovementType('out'); setMovementData({ quantity: 1, observation: ''}); setMovementModalOpen(true); }}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-md transition-colors" title="Retirar para Serviço"
                          >
                            <ArrowDownToLine size={18} />
                          </button>
                          <div className="w-px h-6 bg-slate-200 mx-1"></div>
                          <button onClick={() => openHistory(item)} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors" title="Histórico">
                            <History size={18} />
                          </button>
                          <button onClick={() => {
                            setEditingItem(item);
                            setFormData({
                              name: item.name, current_quantity: String(item.current_quantity), unit: item.unit || '', price: item.price ? String(item.price) : '', 
                              serial_number: item.serial_number || '', asset_tag: item.asset_tag || '', model: item.model || '', observations: item.observations || '', min_stock_limit: String(item.min_stock_limit)
                            });
                            setItemModalOpen(true);
                          }} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors" title="Editar">
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Excluir">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-semibold text-slate-800">{editingItem ? 'Editar Material' : 'Novo Material'}</h2>
              <button onClick={() => setItemModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1"><Trash2 size={20} className="hidden"/></button>
            </div>
            <form onSubmit={handleSaveItem} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Material *</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" placeholder="Ex: Ferro de solda" />
                </div>
                {!editingItem && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade Inicial *</label>
                    <input required type="number" min="0" step="any" value={formData.current_quantity} onChange={e => setFormData({...formData, current_quantity: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Limite de Baixo Estoque</label>
                  <input type="number" min="0" step="any" value={formData.min_stock_limit} onChange={e => setFormData({...formData, min_stock_limit: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                  <p className="text-xs text-slate-400 mt-1">Avisar quando chegar neste valor (Padrão: 2).</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unidade (Opcional)</label>
                  <input type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" placeholder="Ex: metro, tubo, un" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preço Aproximado R$ (Opcional)</label>
                  <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Modelo (Opcional)</label>
                  <input type="text" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nº de Série (Opcional)</label>
                  <input type="text" value={formData.serial_number} onChange={e => setFormData({...formData, serial_number: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tombamento (Opcional)</label>
                  <input type="text" value={formData.asset_tag} onChange={e => setFormData({...formData, asset_tag: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Observações Gerais</label>
                  <textarea rows={3} value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setItemModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={isSaving} className={`px-4 py-2 text-white rounded-lg transition-colors ${isSaving ? 'bg-green-600 shadow-md scale-105' : 'bg-primary-600 hover:bg-primary-700'}`}>{isSaving ? 'Salvando...' : 'Salvar Material'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {isMovementModalOpen && movementItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className={`p-6 border-b border-slate-100 flex items-center gap-3 ${movementType === 'in' ? 'bg-green-50' : 'bg-orange-50'}`}>
              <div className={`p-2 rounded-full ${movementType === 'in' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                {movementType === 'in' ? <ArrowUpFromLine size={24} /> : <ArrowDownToLine size={24} />}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">{movementType === 'in' ? 'Entrada no Estoque' : 'Retirada para Serviço'}</h2>
                <p className="text-sm text-slate-500">{movementItem.name}</p>
              </div>
            </div>
            <form onSubmit={handleSaveMovement} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                  <div className="flex items-center gap-2">
                    <input required type="number" min="0.01" step="any" max={movementType === 'out' ? movementItem.current_quantity : undefined} value={movementData.quantity} onChange={e => setMovementData({...movementData, quantity: parseFloat(e.target.value)})} className="w-full p-2 text-lg font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                    <span className="text-slate-500">{movementItem.unit || 'un'}</span>
                  </div>
                  {movementType === 'out' && <p className="text-xs text-slate-400 mt-1">Disponível: {movementItem.current_quantity}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Motivo / Observação (Ex: Manutenção X)</label>
                  <input type="text" value={movementData.observation} onChange={e => setMovementData({...movementData, observation: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" placeholder="Opcional..." />
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-600 flex items-start gap-2">
                  <Package className="shrink-0 mt-0.5 text-slate-400" size={16} />
                  <div>
                    Registrado em nome de: <span className="font-medium text-slate-800">{user?.full_name}</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setMovementModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" className={`px-4 py-2 text-white rounded-lg transition-colors ${movementType === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>Confirmar {movementType === 'in' ? 'Entrada' : 'Retirada'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Histórico de Movimentações</h2>
                <p className="text-sm text-slate-500">{editingItem.name}</p>
              </div>
              <button onClick={() => setHistoryModalOpen(false)} className="px-3 py-1 bg-slate-200 text-slate-600 hover:bg-slate-300 rounded-md transition-colors text-sm font-medium">Fechar</button>
            </div>
            <div className="p-6 overflow-y-auto">
              {movementsHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-500">Nenhuma movimentação registrada para este item.</div>
              ) : (
                <div className="space-y-4">
                  {movementsHistory.map(m => (
                    <div key={m.id} className="flex gap-4 p-4 rounded-lg border border-slate-100 bg-slate-50/50">
                      <div className={`mt-1 p-2 rounded-full shrink-0 h-fit ${m.movement_type === 'in' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                        {m.movement_type === 'in' ? <ArrowUpFromLine size={16} /> : <ArrowDownToLine size={16} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium text-slate-800">
                              {m.movement_type === 'in' ? 'Entrada' : 'Saída'} de {m.quantity} {editingItem.unit || 'un'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 font-medium">
                            {new Date(m.date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <div className="text-sm text-slate-600 mt-1">
                          Responsável: <span className="font-medium">{m.responsible_name}</span>
                        </div>
                        {m.observation && (
                          <div className="text-sm text-slate-500 mt-2 p-2 bg-white rounded border border-slate-100">
                            "{m.observation}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
