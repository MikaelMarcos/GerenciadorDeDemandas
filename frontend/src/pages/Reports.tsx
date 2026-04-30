import { useState } from 'react';
import { FileDown, Calendar, DownloadCloud, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import api from '../api';

export default function Reports() {
  const [filterType, setFilterType] = useState('weekly'); // weekly, monthly, specific
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [noData, setNoData] = useState(false);

  const getDates = () => {
    let start = startDate;
    let end = endDate;
    if (filterType === 'weekly') {
      const date = new Date();
      end = date.toISOString().split('T')[0];
      date.setDate(date.getDate() - 7);
      start = date.toISOString().split('T')[0];
    } else if (filterType === 'monthly') {
      const date = new Date();
      end = date.toISOString().split('T')[0];
      date.setMonth(date.getMonth() - 1);
      start = date.toISOString().split('T')[0];
    }
    return { start, end };
  }

  const handleExport = async () => {
    setIsExporting(true);
    setNoData(false);
    
    const { start, end } = getDates();

    try {
      const res = await api.get('/reports', {
        params: { start_date: start, end_date: end }
      });

      const data = res.data.data;
      if (data.length === 0) {
        setNoData(true);
        setIsExporting(false);
        return;
      }

      // Convertendo array de objetos para CSV String
      const headers = Object.keys(data[0]);
      const csvRows = [];
      
      csvRows.push(headers.join(','));

      for (const row of data) {
        const values = headers.map(header => {
          let val = row[header];
          if (val === null || val === undefined) val = "";
          val = String(val);
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
             val = `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        });
        csvRows.push(values.join(','));
      }

      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `nuiam_relatorio_${start}_a_${end}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error(err);
      alert('Erro ao gerar CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    setNoData(false);
    
    const { start, end } = getDates();

    try {
      const res = await api.get('/reports', {
        params: { start_date: start, end_date: end }
      });

      const data = res.data.data;
      if (data.length === 0) {
        setNoData(true);
        setIsExporting(false);
        return;
      }

      const doc = new jsPDF('landscape');
      
      // Cabeçalho Premium do Relatório PDF
      doc.setFillColor(30, 58, 138); // bg-blue-900 equivalent
      doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
      
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório Oficial de Manutenções - NUIAM', 14, 20);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período analisado: ${start} até ${end}   |   Total de Intervenções: ${data.length}`, 14, 28);
      doc.text(`Gerado por: Sistema Integrado NUIAM em ${new Date().toLocaleDateString()}`, 14, 34);

      // Preparando Tabela (Corrigido as chaves de nomenclatura)
      const tableColumn = ["Data", "Sistema Geral", "Subsistema", "Ativo", "Categoria", "Ocorrência", "Interf. Elét.", "Peças Substituídas"];
      const tableRows: any[] = [];

      data.forEach((svc: any) => {
        const rowData = [
          svc["Data da Manutencao"],
          svc["Sistema Geral"],           // Nomeclatura nova
          svc["Subsistema / Localidade"], // Nomeclatura nova
          svc["Tag do Ativo"],
          svc["Categoria Ativo"],
          svc["Tipo Manutencao"],
          svc["Interferencia Eletrica"],
          svc["Pecas Substituidas"] || '-'
        ];
        tableRows.push(rowData);
      });

      // @ts-ignore
      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        styles: { fontSize: 9, cellPadding: 4, font: 'helvetica' },
        headStyles: { fillColor: [37, 99, 235], textColor: [255,255,255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'striped'
      });

      doc.save(`nuiam_relatorio_oficial_${start}_a_${end}.pdf`);

    } catch (err) {
      console.error(err);
      alert('Erro ao gerar PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Banner Header */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative">
        <div className="h-40 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 relative overflow-hidden">
           <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 rounded-full bg-white opacity-20 blur-3xl"></div>
           <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-48 h-48 rounded-full bg-white opacity-20 blur-2xl"></div>
           <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMjBoMjBWMEgwem0xOSAxSDFWMWgxOHYxOHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')]"></div>
        </div>
        
        <div className="px-8 pb-8">
          <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-16 relative z-10">
            <div className="w-32 h-32 rounded-full bg-white border-4 border-white flex items-center justify-center text-teal-600 shadow-xl relative">
              <FileDown size={56} className="drop-shadow-sm" />
            </div>
            
            <div className="flex-1 pb-2">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Exportação de Relatórios</h1>
              <p className="text-slate-500 font-medium mt-1">Gere documentos oficiais e analíticos das manutenções do NUIAM.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
          <div className="p-3 bg-teal-100 text-teal-600 rounded-2xl shadow-inner">
             <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Filtro de Período</h2>
            <p className="text-xs text-slate-500 font-medium">Defina o intervalo de tempo para a extração dos dados</p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button 
              onClick={() => setFilterType('weekly')}
              className={`py-4 px-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 transition-all duration-300 transform active:scale-95
                ${filterType === 'weekly' ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-md ring-4 ring-teal-50/50' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'}`}
            >
              <Calendar size={24} className={filterType === 'weekly' ? 'text-teal-600' : 'text-slate-400'} />
              <span className="font-bold">Última Semana</span>
            </button>
            <button 
              onClick={() => setFilterType('monthly')}
              className={`py-4 px-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 transition-all duration-300 transform active:scale-95
                ${filterType === 'monthly' ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-md ring-4 ring-teal-50/50' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'}`}
            >
              <Calendar size={24} className={filterType === 'monthly' ? 'text-teal-600' : 'text-slate-400'} />
              <span className="font-bold">Último Mês</span>
            </button>
            <button 
              onClick={() => setFilterType('specific')}
              className={`py-4 px-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 transition-all duration-300 transform active:scale-95
                ${filterType === 'specific' ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-md ring-4 ring-teal-50/50' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'}`}
            >
              <Calendar size={24} className={filterType === 'specific' ? 'text-teal-600' : 'text-slate-400'} />
              <span className="font-bold">Data Específica</span>
            </button>
          </div>

          {filterType === 'specific' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Data Inicial</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Data Final</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all shadow-sm"
                />
              </div>
            </div>
          )}

          {noData && (
            <div className="bg-amber-50 text-amber-800 p-5 rounded-2xl border border-amber-200 flex items-start gap-4 animate-in fade-in">
              <AlertCircle className="text-amber-500 shrink-0 w-6 h-6" />
              <div>
                <p className="font-bold">Nenhum dado encontrado</p>
                <p className="text-sm mt-1">Não existem serviços registrados neste período no NUIAM. A planilha não foi gerada.</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-4">
          <button
            onClick={handleExport}
            disabled={isExporting || (filterType === 'specific' && (!startDate || !endDate))}
            className="bg-white border-2 text-teal-700 border-teal-200 hover:bg-teal-50 hover:border-teal-300 px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm w-full sm:w-auto transform active:scale-95"
          >
            <DownloadCloud size={20} />
            Baixar CSV (Excel)
          </button>
          
          <button
            onClick={handleExportPDF}
            disabled={isExporting || (filterType === 'specific' && (!startDate || !endDate))}
            className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-teal-500/20 w-full sm:w-auto transform active:scale-95"
          >
            <FileText size={20} />
            Gerar Relatório PDF Oficial
          </button>
        </div>
      </div>
    </div>
  );
}
