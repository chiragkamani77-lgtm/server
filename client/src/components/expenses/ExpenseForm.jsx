import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { sitesApi, expensesApi, fundsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { Loader, Wallet } from 'lucide-react'

export function ExpenseForm({ expense = null, siteId = null, onSuccess, onCancel }) {
  const { isAdmin } = useAuth()
  const isEditing = Boolean(expense)

  const [sites, setSites] = useState([])
  const [walletBalance, setWalletBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    siteId: expense?.site?._id || siteId || '',
    amount: expense?.requestedAmount || '',
    description: expense?.description || '',
    vendorName: expense?.vendorName || '',
    expenseDate: expense?.expenseDate
      ? new Date(expense.expenseDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
  })

  const [errors, setErrors] = useState({})

  const amountEntered = parseFloat(form.amount) > 0

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [sitesRes, walletRes] = await Promise.all([
        sitesApi.getAll(),
        fundsApi.getWalletSummary().catch(() => null),
      ])
      const sitesList = Array.isArray(sitesRes.data) ? sitesRes.data : []
      setSites(sitesList)
      if (walletRes) setWalletBalance(walletRes.data)
      if (!isAdmin && !form.siteId && sitesList.length > 0) {
        setForm((prev) => ({ ...prev, siteId: sitesList[0]._id }))
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors = {}
    if (isAdmin && !form.siteId) newErrors.siteId = 'Site is required'
    if (!form.amount || parseFloat(form.amount) <= 0) newErrors.amount = 'Valid amount is required'
    if (!form.description?.trim()) newErrors.description = 'Description is required'
    if (!form.expenseDate) newErrors.expenseDate = 'Date is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    setSubmitting(true)
    try {
      const payload = {
        amount: parseFloat(form.amount),
        description: form.description,
        vendorName: form.vendorName,
        expenseDate: form.expenseDate,
        ...(isAdmin && form.siteId ? { siteId: form.siteId } : {}),
      }
      if (isEditing) {
        if (!isAdmin) { delete payload.siteId; delete payload.amount }
        await expensesApi.update(expense._id, payload)
      } else {
        await expensesApi.create(payload)
      }
      onSuccess?.()
    } catch (error) {
      console.error('Failed to save expense:', error)
      if (error.response?.data?.message) setErrors({ submit: error.response.data.message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Wallet balance (read-only info) */}
      {walletBalance && (
        <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5 text-blue-700 font-medium">
            <Wallet className="h-4 w-4" />
            Available Balance
          </span>
          <span className={`font-bold ${walletBalance.remainingBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {formatCurrency(walletBalance.remainingBalance)}
          </span>
        </div>
      )}

      {/* Site — admin selects, non-admin auto-detected */}
      {isAdmin ? (
        <div className="space-y-2">
          <Label htmlFor="siteId">Site <span className="text-red-500">*</span></Label>
          <Select value={form.siteId} onValueChange={(v) => handleChange('siteId', v)}>
            <SelectTrigger className={errors.siteId ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select site" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((site) => (
                <SelectItem key={site._id} value={site._id}>{site.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.siteId && <p className="text-sm text-red-500">{errors.siteId}</p>}
        </div>
      ) : (
        sites.length > 0 && (
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Site: </span>
            <span className="font-medium">{sites.find((s) => s._id === form.siteId)?.name || sites[0]?.name}</span>
          </div>
        )
      )}

      {/* Amount — shown first */}
      <div className="space-y-2">
        <Label htmlFor="amount">Amount <span className="text-red-500">*</span></Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="Enter amount"
          value={form.amount}
          onChange={(e) => handleChange('amount', e.target.value)}
          disabled={isEditing && !isAdmin}
          className={errors.amount ? 'border-red-500' : ''}
          autoFocus
        />
        {errors.amount && <p className="text-sm text-red-500">{errors.amount}</p>}
      </div>

      {/* Rest of form — shown after amount is entered */}
      {amountEntered && (
        <>
          <div className="space-y-2">
            <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
            <Textarea
              id="description"
              placeholder="What did you spend on?"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendorName">Vendor / Shop Name</Label>
            <Input
              id="vendorName"
              placeholder="Where did you buy? (optional)"
              value={form.vendorName}
              onChange={(e) => handleChange('vendorName', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expenseDate">Date <span className="text-red-500">*</span></Label>
            <Input
              id="expenseDate"
              type="date"
              value={form.expenseDate}
              onChange={(e) => handleChange('expenseDate', e.target.value)}
              className={errors.expenseDate ? 'border-red-500' : ''}
            />
            {errors.expenseDate && <p className="text-sm text-red-500">{errors.expenseDate}</p>}
          </div>
        </>
      )}

      {errors.submit && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{errors.submit}</div>
      )}

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={submitting || !amountEntered} className="flex-1">
          {submitting ? (
            <><Loader className="mr-2 h-4 w-4 animate-spin" />{isEditing ? 'Updating...' : 'Saving...'}</>
          ) : (
            <>{isEditing ? 'Update Expense' : 'Add Expense'}</>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
