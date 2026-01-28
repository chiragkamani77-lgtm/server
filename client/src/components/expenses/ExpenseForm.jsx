import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { sitesApi, categoriesApi, expensesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FundAllocationSelector } from '@/components/FundAllocationSelector'
import { Loader } from 'lucide-react'

/**
 * Reusable Expense Form Component
 * Handles both create and edit operations
 * Props:
 * - expense: (optional) Expense object for editing
 * - siteId: (optional) Pre-selected site ID
 * - onSuccess: Callback on successful submit
 * - onCancel: Callback on cancel
 */
export function ExpenseForm({ expense = null, siteId = null, onSuccess, onCancel }) {
  const { isAdmin } = useAuth()
  const isEditing = Boolean(expense)

  const [sites, setSites] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    siteId: expense?.site?._id || siteId || '',
    categoryId: expense?.category?._id || '',
    fundAllocationId: expense?.fundAllocation?._id || '',
    amount: expense?.requestedAmount || '',
    description: expense?.description || '',
    vendorName: expense?.vendorName || '',
    expenseDate: expense?.expenseDate ? new Date(expense.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  })

  const [errors, setErrors] = useState({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [sitesRes, categoriesRes] = await Promise.all([
        sitesApi.getAll(),
        categoriesApi.getAll(),
      ])
      // Backend returns arrays directly
      setSites(Array.isArray(sitesRes.data) ? sitesRes.data : [])
      setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!form.siteId) newErrors.siteId = 'Site is required'
    if (!form.categoryId) newErrors.categoryId = 'Category is required'
    if (!form.fundAllocationId) newErrors.fundAllocationId = 'Fund allocation is required'
    if (!form.amount || parseFloat(form.amount) <= 0) {
      newErrors.amount = 'Valid amount is required'
    }
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
        siteId: form.siteId,
        categoryId: form.categoryId,
        fundAllocationId: form.fundAllocationId,
        amount: parseFloat(form.amount),
        description: form.description,
        vendorName: form.vendorName,
        expenseDate: form.expenseDate,
      }

      if (isEditing) {
        // For editing, non-admins can only update certain fields
        if (!isAdmin) {
          delete payload.siteId
          delete payload.categoryId
          delete payload.amount
        }
        await expensesApi.update(expense._id, payload)
      } else {
        await expensesApi.create(payload)
      }

      onSuccess?.()
    } catch (error) {
      console.error('Failed to save expense:', error)
      // Show validation errors from server
      if (error.response?.data?.message) {
        setErrors({ submit: error.response.data.message })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
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
      {/* Site Selection */}
      <div className="space-y-2">
        <Label htmlFor="siteId">
          Site <span className="text-red-500">*</span>
        </Label>
        <Select
          value={form.siteId}
          onValueChange={(value) => handleChange('siteId', value)}
          disabled={isEditing && !isAdmin}
        >
          <SelectTrigger className={errors.siteId ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select site" />
          </SelectTrigger>
          <SelectContent>
            {sites.map((site) => (
              <SelectItem key={site._id} value={site._id}>
                {site.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.siteId && (
          <p className="text-sm text-red-500">{errors.siteId}</p>
        )}
      </div>

      {/* Category Selection */}
      <div className="space-y-2">
        <Label htmlFor="categoryId">
          Category <span className="text-red-500">*</span>
        </Label>
        <Select
          value={form.categoryId}
          onValueChange={(value) => handleChange('categoryId', value)}
          disabled={isEditing && !isAdmin}
        >
          <SelectTrigger className={errors.categoryId ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category._id} value={category._id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.categoryId && (
          <p className="text-sm text-red-500">{errors.categoryId}</p>
        )}
      </div>

      {/* Fund Allocation Selector */}
      <div className="space-y-2">
        <Label>
          Fund Allocation <span className="text-red-500">*</span>
        </Label>
        <FundAllocationSelector
          value={form.fundAllocationId}
          onChange={(value) => handleChange('fundAllocationId', value)}
          siteId={form.siteId}
          disabled={isEditing && !isAdmin}
          error={errors.fundAllocationId}
        />
        {errors.fundAllocationId && (
          <p className="text-sm text-red-500">{errors.fundAllocationId}</p>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">
          Amount <span className="text-red-500">*</span>
        </Label>
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
        />
        {errors.amount && (
          <p className="text-sm text-red-500">{errors.amount}</p>
        )}
      </div>

      {/* Vendor Name */}
      <div className="space-y-2">
        <Label htmlFor="vendorName">Vendor Name</Label>
        <Input
          id="vendorName"
          placeholder="Enter vendor name"
          value={form.vendorName}
          onChange={(e) => handleChange('vendorName', e.target.value)}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">
          Description <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="description"
          placeholder="Enter description"
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
          className={errors.description ? 'border-red-500' : ''}
        />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description}</p>
        )}
      </div>

      {/* Expense Date */}
      <div className="space-y-2">
        <Label htmlFor="expenseDate">
          Expense Date <span className="text-red-500">*</span>
        </Label>
        <Input
          id="expenseDate"
          type="date"
          value={form.expenseDate}
          onChange={(e) => handleChange('expenseDate', e.target.value)}
          className={errors.expenseDate ? 'border-red-500' : ''}
        />
        {errors.expenseDate && (
          <p className="text-sm text-red-500">{errors.expenseDate}</p>
        )}
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {errors.submit}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={submitting} className="flex-1">
          {submitting ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            <>{isEditing ? 'Update Expense' : 'Add Expense'}</>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
