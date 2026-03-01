/**
 * Horizontally scrollable tab strip.
 * Supports any number of tabs — overflows gracefully on small screens.
 *
 * Props:
 *   tabs      – [{ id, label, icon?: LucideComponent }]
 *   activeTab – id of the currently active tab
 *   onChange  – (id) => void
 */
export function TabStrip({ tabs = [], activeTab, onChange }) {
  return (
    <div className="bg-white border-b border-gray-200 shrink-0">
      {/* scrollbar-hide makes it horizontally scrollable without a visible scrollbar on all browsers */}
      <div className="flex overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={[
                'flex-none flex flex-col items-center gap-1 px-5 py-3',
                'text-[11px] font-semibold whitespace-nowrap transition-colors border-b-2',
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600',
              ].join(' ')}
            >
              {Icon && (
                <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
              )}
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
