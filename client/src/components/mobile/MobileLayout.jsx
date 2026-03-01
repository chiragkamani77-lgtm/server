import { MobileHeader } from './MobileHeader'
import { TabStrip } from './TabStrip'
import { FAB } from './FAB'

/**
 * Full-page mobile shell: header + scrollable tabs + content area + FAB.
 *
 * Props:
 *   title       – app title in header
 *   subtitle    – optional site name shown below title
 *   userName    – user name shown below title
 *   wallet      – { remainingBalance } for wallet display
 *   onLogout    – logout callback
 *   headerRight – optional extra node in header right area (before logout)
 *
 *   tabs        – [{ id, label, icon? }] — omit to hide tab strip
 *   activeTab   – active tab id
 *   onTabChange – (id) => void
 *
 *   fabLabel    – aria-label for FAB (omit to hide FAB)
 *   fabIcon     – custom icon for FAB
 *   onFabClick  – FAB click callback (omit to hide FAB)
 *
 *   children    – page body content
 */
export function MobileLayout({
  title,
  subtitle,
  userName,
  wallet,
  onLogout,
  headerRight,
  tabs,
  activeTab,
  onTabChange,
  fabLabel,
  fabIcon,
  onFabClick,
  children,
}) {
  return (
    <div className="min-h-screen max-w-full bg-gray-50 flex flex-col overflow-x-hidden">
      <MobileHeader
        title={title}
        subtitle={subtitle}
        userName={userName}
        wallet={wallet}
        onLogout={onLogout}
        right={headerRight}
      />

      {tabs?.length > 0 && (
        <TabStrip tabs={tabs} activeTab={activeTab} onChange={onTabChange} />
      )}

      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      {onFabClick && (
        <FAB onClick={onFabClick} label={fabLabel} icon={fabIcon} />
      )}
    </div>
  )
}
