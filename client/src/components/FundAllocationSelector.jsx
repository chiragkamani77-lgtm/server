import { useState, useEffect } from 'react'
import { fundsApi } from '@/lib/api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export function FundAllocationSelector({
  value,
  onChange,
  requestedAmount = 0,
  required = false,
  label = "Fund Allocation",
  className = ""
}) {
  const [allocations, setAllocations] = useState([])
  const [utilization, setUtilization] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAllocations()
  }, [])

  useEffect(() => {
    if (value) {
      fetchUtilization(value)
    } else {
      setUtilization(null)
    }
  }, [value, requestedAmount])

  const fetchAllocations = async () => {
    try {
      const response = await fundsApi.getAll({ status: 'disbursed', limit: 100 })
      setAllocations(response.data.allocations || [])
    } catch (err) {
      console.error('Failed to fetch fund allocations:', err)
    }
  }

  const fetchUtilization = async (allocationId) => {
    if (!allocationId) return

    setLoading(true)
    setError(null)

    try {
      const data = await fundsApi.getUtilization(allocationId)
      setUtilization(data.summary)

      // Check if requested amount exceeds available balance
      if (requestedAmount > 0 && data.summary.remainingBalance < requestedAmount) {
        setError({
          type: 'insufficient',
          message: `Insufficient funds. Available: ${formatCurrency(data.summary.remainingBalance)}, Requested: ${formatCurrency(requestedAmount)}`
        })
      }
    } catch (err) {
      console.error('Failed to fetch utilization:', err)
      setError({
        type: 'error',
        message: 'Failed to check fund availability'
      })
    } finally {
      setLoading(false)
    }
  }

  const hasError = error?.type === 'insufficient'
  const hasSufficientFunds = utilization && requestedAmount > 0 && utilization.remainingBalance >= requestedAmount

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
              No disbursed fund allocations available
            </div>
          )}
          {allocations.map((allocation) => (
            <SelectItem key={allocation._id} value={allocation._id}>
              <div className="flex flex-col">
                <span className="font-medium">
                  {allocation.fromUser?.name} → {allocation.toUser?.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(allocation.amount)} - {allocation.purpose}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
          <span>Checking fund availability...</span>
        </div>
      )}

      {utilization && !loading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm p-3 bg-muted rounded-lg">
            <div>
              <p className="font-medium">Fund Balance</p>
              <p className="text-xs text-muted-foreground">
                Allocated: {formatCurrency(utilization.allocated)} |
                Used: {formatCurrency(utilization.totalUtilized)} ({utilization.utilizationPercent}%)
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">{formatCurrency(utilization.remainingBalance)}</p>
              <p className="text-xs text-muted-foreground">Available</p>
            </div>
          </div>

          {hasSufficientFunds && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Sufficient funds available for this transaction
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
            Fund allocation is required. All expenses and bills must be linked to a fund allocation.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
