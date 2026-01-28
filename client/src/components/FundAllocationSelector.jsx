import { useState, useEffect } from 'react'
import { fundsApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2, Info, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export function FundAllocationSelector({
  value,
  onChange,
  requestedAmount = 0,
  required = false,
  label = "Fund Allocation",
  className = ""
}) {
  const { user } = useAuth()
  const [allocations, setAllocations] = useState([])
  const [walletBalance, setWalletBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAllocations()
    fetchWalletBalance()
  }, [])

  useEffect(() => {
    if (requestedAmount > 0 && walletBalance !== null) {
      validateAmount()
    } else {
      setError(null)
    }
  }, [requestedAmount, walletBalance])

  const fetchAllocations = async () => {
    try {
      const response = await fundsApi.getAll({ status: 'disbursed', limit: 100 })
      const allAllocations = response.data.allocations || []

      // Filter to show only allocations where current user is the recipient
      const myAllocations = allAllocations.filter(a => a.toUser?._id === user?._id)

      setAllocations(myAllocations)
    } catch (err) {
      console.error('Failed to fetch fund allocations:', err)
    }
  }

  const fetchWalletBalance = async () => {
    setLoading(true)
    try {
      const response = await fundsApi.getWalletSummary()
      setWalletBalance(response.data)
    } catch (err) {
      console.error('Failed to fetch wallet balance:', err)
      setError({
        type: 'error',
        message: 'Failed to check wallet balance'
      })
    } finally {
      setLoading(false)
    }
  }

  const validateAmount = () => {
    if (!walletBalance) return

    if (requestedAmount > walletBalance.remainingBalance) {
      setError({
        type: 'insufficient',
        message: `Insufficient wallet balance. Available: ${formatCurrency(walletBalance.remainingBalance)}, Requested: ${formatCurrency(requestedAmount)}`
      })
    } else {
      setError(null)
    }
  }

  const hasError = error?.type === 'insufficient'
  const hasSufficientFunds = walletBalance && requestedAmount > 0 && walletBalance.remainingBalance >= requestedAmount

  return (
    <div className={`space-y-2 ${className}`}>
      <Label>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      <Select
        value={value}
        onValueChange={onChange}
        required={required}
      >
        <SelectTrigger className={hasError ? 'border-red-500' : ''}>
          <SelectValue placeholder="Select fund allocation" />
        </SelectTrigger>
        <SelectContent>
          {allocations.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground text-center">
              No fund allocations available. Please request funds first.
            </div>
          )}
          {allocations.map((allocation) => (
            <SelectItem key={allocation._id} value={allocation._id}>
              <div className="flex flex-col">
                <span className="font-medium">
                  From: {allocation.fromUser?.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(allocation.amount)} - {new Date(allocation.allocationDate).toLocaleDateString()}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
          <span>Checking wallet balance...</span>
        </div>
      )}

      {walletBalance && !loading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm p-3 bg-muted rounded-lg">
            <div>
              <p className="font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Your Wallet Balance
              </p>
              <p className="text-xs text-muted-foreground">
                Received: {formatCurrency(walletBalance.totalReceived)} |
                Spent: {formatCurrency(walletBalance.totalSpent)}
              </p>
            </div>
            <div className="text-right">
              <p className={`font-bold text-lg ${walletBalance.remainingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(walletBalance.remainingBalance)}
              </p>
              <p className="text-xs text-muted-foreground">Available</p>
            </div>
          </div>

          {hasSufficientFunds && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Sufficient funds available in your wallet
              </AlertDescription>
            </Alert>
          )}

          {hasError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {required && !value && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Fund allocation is required for audit trail. Select the allocation this expense should be linked to.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
