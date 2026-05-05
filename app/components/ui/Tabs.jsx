'use client';
export default function Tabs({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`flex gap-1 p-1 bg-[rgba(32,24,19,0.06)] rounded-[14px] w-fit mb-6 ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.key || tab}
          onClick={() => onChange(tab.key || tab)}
          className={`px-[18px] py-[8px] rounded-[12px] text-xs font-bold flex items-center gap-[6px] transition-all duration-150 ${
            (activeTab === (tab.key || tab))
              ? 'bg-white text-[#201813] shadow-[0_4px_18px_rgba(31,17,8,0.06)]'
              : 'text-[#5f564f] hover:text-[#201813] hover:bg-[rgba(32,24,19,0.05)]'
          }`}
        >
          {tab.icon && <span>{tab.icon}</span>}
          {tab.label || tab}
        </button>
      ))}
    </div>
  );
}
