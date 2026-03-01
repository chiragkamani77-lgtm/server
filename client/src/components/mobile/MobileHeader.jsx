import { Building2, LogOut } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

/**
 * Dark top header for mobile-first role pages.
 * Props:
 *   title      – app/org name (default 'Construction')
 *   subtitle   – optional site name shown below title (e.g. 'Site A')
 *   userName   – logged-in user's name
 *   wallet     – { remainingBalance } from fundsApi.getWalletSummary()
 *   onLogout   – callback
 *   right      – optional extra node rendered before logout (e.g. notification bell)
 */
export function MobileHeader({ title = 'Construction', subtitle, userName, wallet, onLogout, right }) {
  return (
    <header className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">{title}</p>
          {subtitle && <p className="text-[11px] text-amber-300 leading-tight">{subtitle}</p>}
          {userName && <p className="text-[11px] text-blue-300 leading-tight">{userName}</p>}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {wallet != null && (
          <div className="text-right">
            <p className={`text-sm font-bold leading-tight ${wallet.remainingBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(wallet.remainingBalance)}
            </p>
            <p className="text-[10px] text-slate-400 leading-tight">balance</p>
          </div>
        )}
        {right}
        {onLogout && (
          <button onClick={onLogout} className="text-slate-400 hover:text-white transition-colors" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  )
}
