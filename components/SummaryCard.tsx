
import React from 'react';

interface SummaryCardProps {
  label: string;
  value: number;
  type?: 'income' | 'expense' | 'paid' | 'balance';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, type = 'balance' }) => {
  const getStyles = () => {
    switch (type) {
      case 'income': return 'text-emerald-600';
      case 'expense': return 'text-rose-600';
      case 'paid': return 'text-blue-600';
      default: return value >= 0 ? 'text-slate-800' : 'text-rose-700';
    }
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between h-full min-h-[100px]">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-bold mt-1 ${getStyles()}`}>
        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
      </span>
    </div>
  );
};

export default SummaryCard;
