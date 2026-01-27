import { useState, useEffect } from 'react'
import { investmentsApi } from '@/lib/api'
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
import { formatCurrency, formatDate } from '@/lib/utils'

export function InvestmentSelector({
  value,
  onChange,
  requestedAmount = 0,
  required = false,
  label = "Investment",
  className = ""
}) {
  const [investments, setInvestments] = useState([])
  const [utilization, setUtilization] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchInvestments()
  }, [])

  useEffect(() => {
    if (value) {
      fetchUtilization(value)
    } else {
      setUtilization(null)
    }
  }, [value, requestedAmount])

  const fetchInvestments = async () => {
    try {
      const response = await investmentsApi.getAll({ limit: 100 })
      setInvestments(response.data.investments || [])
    } catch (err) {
      console.error('Failed to fetch investments:', err)
    }
  }

  const fetchUtilization = async (investmentId) => {
    if (!investmentId) return

    setLoading(true)
    setError(null)

    try {
      // Find the selected investment
      const investment = investments.find(inv => inv._id === investmentId)
      if (!investment) return

      // TODO: Calculate utilization from linked bills
      // For now, show investment amount
      const mockUtilization = {
        allocated: investment.amount,
        totalUtilized: 0, // This should come from backend
        remainingBalance: investment.amount,
        utilizationPercent: '0'
      }

      setUtilization(mockUtilization)

      // Check if requested amount exceeds available balance
      if (requestedAmount > 0 && mockUtilization.remainingBalance < requestedAmount) {
        setError({
          type: 'insufficient',
          message: `Insufficient funds. Available: ${formatCurrency(mockUtilization.remainingBalance)}, Requested: ${formatCurrency(requestedAmount)}`
        })
      }
    } catch (err) {
      console.error('Failed to check investment:', err)
      setError({
        type: 'error',
        message: 'Failed to check investment availability'
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
          <SelectValue placeholder="Select investment" />
        </SelectTrigger>
        <SelectContent>
          {investments.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground text-center">
              No investments available
            </div>
          )}
          {investments.map((investment) => (
            <SelectItem key={investment._id} value={investment._id}>
              <div className="flex flex-col">
                <span className="font-medium">
                  {investment.partner?.name} - {formatCurrency(investment.amount)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(investment.investmentDate)} - {investment.description || 'No description'}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
          <span>Checking investment availability...</span>
        </div>
      )}

      {utilization && !loading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm p-3 bg-muted rounded-lg">
            <div>
              <p className="font-medium">Investment Balance</p>
              <p className="text-xs text-muted-foreground">
                Total: {formatCurrency(utilization.allocated)} |
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
                Sufficient funds available for this bill
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
            Investment is required. All bills must be linked to an investment.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
