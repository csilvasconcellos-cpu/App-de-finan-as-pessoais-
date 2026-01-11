
import React, { useState, useEffect } from 'react';
import { EntryType, FinancialEntry } from '../types';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (entry: Partial<FinancialEntry>, installments?: number) => void;
  initialData?: FinancialEntry | null;
  currentMonth: number;
  currentYear: number;
}

const EntryModal: React.FC<EntryModalProps> = ({ isOpen, onClose, onSubmit, initialData, currentMonth, currentYear }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [type, setType] = useState<EntryType>(EntryType.VARIABLE_EXPENSE);
  const [date, setDate] = useState('');
  const [installments, setInstallments] = useState(1);
  const [showInstallments, setShowInstallments] = useState(false);

  useEffect(() => {
    if (initialData) {
      setDescription(initialData.description);
      setAmount(initialData.amount.toString());
      setType(initialData.type);
      setDate(initialData.date.split('T')[0]);
      setShowInstallments(false);
    } else {
      setDescription('');
      setAmount('');
      setType(EntryType.VARIABLE_EXPENSE);
      const today = new Date();
      // Adjust default date to match viewed month
      const defaultDate = new Date(currentYear, currentMonth, Math.min(today.getDate(), 28));
      setDate(defaultDate.toISOString().split('T')[0]);
      setInstallments(1);
      setShowInstallments(false);
    }
  }, [initialData, isOpen, currentMonth, currentYear]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<FinancialEntry> = {
      description,
      amount: parseFloat(amount),
      type,
      date: new Date(date).toISOString(),
    };
    onSubmit(data, showInstallments ? installments : 1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">
            {initialData ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <input
              autoFocus
              required
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Ex: Aluguel, Supermercado, Salário..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
              <input
                required
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EntryType)}
              disabled={!!initialData}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value={EntryType.INCOME}>Receita</option>
              <option value={EntryType.FIXED_EXPENSE}>Despesa Fixa</option>
              <option value={EntryType.VARIABLE_EXPENSE}>Despesa Variável</option>
            </select>
          </div>

          {type === EntryType.VARIABLE_EXPENSE && !initialData && (
            <div className="pt-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInstallments}
                  onChange={(e) => setShowInstallments(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-sm font-medium text-slate-700">Parcelar esta despesa?</span>
              </label>

              {showInstallments && (
                <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Número de Parcelas</label>
                  <input
                    type="number"
                    min="2"
                    max="120"
                    value={installments}
                    onChange={(e) => setInstallments(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              )}
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-200"
            >
              {initialData ? 'Salvar Alterações' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EntryModal;
