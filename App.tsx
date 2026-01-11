
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { EntryType, FinancialEntry, MonthYear } from './types';
import { MONTHS, COLORS } from './constants';
import SummaryCard from './components/SummaryCard';
import EntryModal from './components/EntryModal';

const App: React.FC = () => {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [view, setView] = useState<MonthYear>({
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('finance_entries');
    if (saved) {
      try {
        setEntries(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved entries", e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('finance_entries', JSON.stringify(entries));
  }, [entries]);

  // Replication logic: check if we need to propagate fixed or unpaid entries
  const handleReplication = useCallback((currentEntries: FinancialEntry[], targetView: MonthYear) => {
    const prevMonth = targetView.month === 0 ? 11 : targetView.month - 1;
    const prevYear = targetView.month === 0 ? targetView.year - 1 : targetView.year;

    const prevMonthEntries = currentEntries.filter(e => e.month === prevMonth && e.year === prevYear);
    const targetMonthEntries = currentEntries.filter(e => e.month === targetView.month && e.year === targetView.year);

    let newReplications: FinancialEntry[] = [];

    // 1. Process Fixed Expenses from previous month (Standard Recurring)
    // "Despesas fixas continuam sendo geradas normalmente no mês seguinte"
    const prevFixedOriginals = prevMonthEntries.filter(e => e.type === EntryType.FIXED_EXPENSE);
    
    // We only replicate the "Template" of the fixed expense. 
    // We check if it already exists in the target month (to avoid duplication).
    prevFixedOriginals.forEach(prev => {
      const alreadyExists = targetMonthEntries.some(curr => 
        curr.type === EntryType.FIXED_EXPENSE && 
        curr.description === prev.description &&
        !curr.isReplicated // It's the standard monthly occurrence
      );

      if (!alreadyExists) {
        const nextDate = new Date(prev.date);
        nextDate.setMonth(targetView.month);
        nextDate.setFullYear(targetView.year);
        
        newReplications.push({
          ...prev,
          id: crypto.randomUUID(),
          month: targetView.month,
          year: targetView.year,
          date: nextDate.toISOString(),
          isPaid: false, // Starts unpaid in new month
          isReplicated: false // This is the base occurrence for the month
        });
      }
    });

    // 2. Process Unpaid Pendencies (Fixed and Variable)
    // "Despesas fixas não pagas devem ser replicadas automaticamente... até que sejam pagas"
    // "Despesas variáveis em atraso devem ser replicadas automaticamente..."
    const pendencies = prevMonthEntries.filter(e => !e.isPaid && e.type !== EntryType.INCOME);
    
    pendencies.forEach(pendency => {
      const alreadyPending = targetMonthEntries.some(curr => 
        curr.originalId === pendency.id || curr.description === `${pendency.description} (Pendente)`
      );

      if (!alreadyPending) {
        newReplications.push({
          ...pendency,
          id: crypto.randomUUID(),
          originalId: pendency.id,
          description: pendency.description.includes('(Pendente)') ? pendency.description : `${pendency.description} (Pendente)`,
          month: targetView.month,
          year: targetView.year,
          isPaid: false,
          isReplicated: true
        });
      }
    });

    if (newReplications.length > 0) {
      setEntries(prev => [...prev, ...newReplications]);
    }
  }, []);

  // Effect to trigger replication when view changes
  useEffect(() => {
    handleReplication(entries, view);
  }, [view, handleReplication, entries.length]);

  const changeMonth = (offset: number) => {
    setView(prev => {
      let newMonth = prev.month + offset;
      let newYear = prev.year;
      if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      } else if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      }
      return { month: newMonth, year: newYear };
    });
  };

  const currentMonthEntries = useMemo(() => {
    const list = entries.filter(e => e.month === view.month && e.year === view.year);
    
    // Custom Sorting:
    // 1. Unpaid Items first, then Paid
    // 2. Within Unpaid: Income -> Fixed -> Variable
    // 3. Paid items at the very bottom
    return list.sort((a, b) => {
      if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
      
      const order = { [EntryType.INCOME]: 0, [EntryType.FIXED_EXPENSE]: 1, [EntryType.VARIABLE_EXPENSE]: 2 };
      return order[a.type] - order[b.type];
    });
  }, [entries, view]);

  const summary = useMemo(() => {
    const income = currentMonthEntries
      .filter(e => e.type === EntryType.INCOME)
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalExpenses = currentMonthEntries
      .filter(e => e.type !== EntryType.INCOME)
      .reduce((sum, e) => sum + e.amount, 0);
    
    const paidExpenses = currentMonthEntries
      .filter(e => e.type !== EntryType.INCOME && e.isPaid)
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      income,
      totalExpenses,
      paidExpenses,
      balance: income - paidExpenses
    };
  }, [currentMonthEntries]);

  const handleAddOrEdit = (data: Partial<FinancialEntry>, numInstallments: number = 1) => {
    if (editingEntry) {
      setEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...e, ...data } : e));
      setEditingEntry(null);
    } else {
      if (numInstallments > 1 && data.type === EntryType.VARIABLE_EXPENSE) {
        const installmentEntries: FinancialEntry[] = [];
        const baseId = crypto.randomUUID();
        const baseAmount = (data.amount || 0) / numInstallments;
        
        for (let i = 0; i < numInstallments; i++) {
          let m = view.month + i;
          let y = view.year;
          while (m > 11) {
            m -= 12;
            y++;
          }
          
          const instDate = new Date(data.date || new Date().toISOString());
          instDate.setMonth(m);
          instDate.setFullYear(y);

          installmentEntries.push({
            id: crypto.randomUUID(),
            type: data.type as EntryType,
            description: `${data.description} (${i + 1}/${numInstallments})`,
            amount: baseAmount,
            date: instDate.toISOString(),
            isPaid: false,
            month: m,
            year: y,
            isInstallment: true,
            installmentNumber: i + 1,
            totalInstallments: numInstallments,
            parentId: baseId
          });
        }
        setEntries(prev => [...prev, ...installmentEntries]);
      } else {
        const newEntry: FinancialEntry = {
          id: crypto.randomUUID(),
          type: data.type as EntryType,
          description: data.description || '',
          amount: data.amount || 0,
          date: data.date || new Date().toISOString(),
          isPaid: false,
          month: view.month,
          year: view.year
        };
        setEntries(prev => [...prev, newEntry]);
      }
    }
  };

  const togglePaid = (id: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, isPaid: !e.isPaid } : e));
  };

  const deleteEntry = (id: string) => {
    if (confirm('Deseja realmente excluir este lançamento?')) {
      setEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  const openEdit = (entry: FinancialEntry) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-32">
      {/* Header & Navigation */}
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">SimpliFinance</h1>
          <p className="text-slate-500 font-medium">Controle suas finanças com clareza.</p>
        </div>
        
        <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-100 p-1">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <div className="px-6 py-1 text-center min-w-[160px]">
            <span className="block text-sm font-bold text-blue-600 uppercase tracking-widest">{MONTHS[view.month]}</span>
            <span className="block text-xs font-semibold text-slate-400">{view.year}</span>
          </div>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>
      </header>

      {/* Summary Area */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <SummaryCard label="Receitas" value={summary.income} type="income" />
        <SummaryCard label="Despesas Total" value={summary.totalExpenses} type="expense" />
        <SummaryCard label="Despesas Pagas" value={summary.paidExpenses} type="paid" />
        <SummaryCard label="Saldo Disponível" value={summary.balance} />
      </section>

      {/* Action Area */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">Lançamentos do Mês</h2>
        <button 
          onClick={() => { setEditingEntry(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          Novo Lançamento
        </button>
      </div>

      {/* Finance List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {currentMonthEntries.length === 0 ? (
          <div className="py-20 text-center">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
               <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
            </div>
            <p className="text-slate-400 font-medium">Nenhum lançamento encontrado para este período.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {currentMonthEntries.map((entry) => (
              <div 
                key={entry.id} 
                className={`group p-4 flex items-center justify-between transition-colors hover:bg-slate-50 ${entry.isPaid ? 'opacity-60 grayscale-[0.5]' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    entry.type === EntryType.INCOME ? COLORS.incomeBg : (entry.type === EntryType.FIXED_EXPENSE ? 'bg-blue-50' : 'bg-orange-50')
                  }`}>
                    {entry.type === EntryType.INCOME ? (
                      <svg className={`w-5 h-5 ${COLORS.income}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    ) : (
                      <svg className={`w-5 h-5 ${entry.type === EntryType.FIXED_EXPENSE ? 'text-blue-500' : 'text-orange-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" transform="rotate(45 12 12)"></path></svg>
                    )}
                  </div>
                  
                  <div>
                    <h3 className={`font-semibold ${entry.isPaid ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {entry.description}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-slate-400 uppercase">
                        {entry.type === EntryType.INCOME ? 'Receita' : (entry.type === EntryType.FIXED_EXPENSE ? 'Fixa' : 'Variável')}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-400">
                        {new Date(entry.date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right mr-2">
                    <span className={`text-lg font-bold block ${
                      entry.type === EntryType.INCOME ? COLORS.income : 'text-slate-700'
                    }`}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.amount)}
                    </span>
                    {entry.isPaid && (
                      <span className="text-[10px] font-bold text-emerald-500 uppercase bg-emerald-50 px-1.5 py-0.5 rounded tracking-wider">Pago</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => togglePaid(entry.id)}
                      title={entry.isPaid ? "Marcar como não pago" : "Marcar como pago"}
                      className={`p-2 rounded-lg transition-all ${
                        entry.isPaid 
                        ? 'bg-emerald-100 text-emerald-600' 
                        : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    </button>
                    
                    <button 
                      onClick={() => openEdit(entry)}
                      className="p-2 rounded-lg bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-500 transition-all"
                      title="Editar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>

                    <button 
                      onClick={() => deleteEntry(entry.id)}
                      className="p-2 rounded-lg bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
                      title="Excluir"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button (Mobile) */}
      <button 
        onClick={() => { setEditingEntry(null); setIsModalOpen(true); }}
        className="fixed bottom-6 right-6 md:hidden w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 transition-transform"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
      </button>

      <EntryModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddOrEdit}
        initialData={editingEntry}
        currentMonth={view.month}
        currentYear={view.year}
      />
    </div>
  );
};

export default App;
