import { useState, useEffect } from 'react'
import { fundsApi } from '@/lib/api'
import { AlertCircle, CheckCircle2, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

/**
 * Shows the logged-in user's wallet balance (read-only).
 * Auto-links to their wallet — no dropdown selection needed.
 * Props:
 *   requestedAmount – number, the amount being requested
 *   className       – extra wrapper class
 */
export function FundAllocationSelector({ requestedAmount = 0, className = '' }) {
  const [walletBalance, setWalletBalance] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fundsApi.getWalletSummary()
      .then((res) => setWalletBalance(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (!walletBalance) return null

  const remaining = walletBalance.remainingBalance ?? 0
  const insufficient = requestedAmount > 0 && requestedAmount > remaining

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${insufficient ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'} ${className}`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
          <Wallet className="h-3.5 w-3.5" />
          Your Wallet
        </span>
        <span className={`text-sm font-bold ${remaining >= 0 ? 'text-green-700' : 'text-red-600'}`}>
          {formatCurrency(remaining)}
        </span>
      </div>
      {insufficient && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Insufficient balance (need {formatCurrency(requestedAmount - remaining)} more)
        </div>
      )}
      {!insufficient && requestedAmount > 0 && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Sufficient funds available
        </div>
      )}
    </div>
  )
}
