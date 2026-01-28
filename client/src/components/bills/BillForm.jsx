import { useState } from 'react'
import { billsApi } from '@/lib/api'
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
 * Reusable GST Bill Form Component
 * Handles both create and edit operations
 * Props:
 * - bill: (optional) Bill object for editing
 * - siteId: (required) Site ID for the bill
 * - onSuccess: Callback on successful submit
 * - onCancel: Callback on cancel
 */
export function BillForm({ bill = null, siteId, onSuccess, onCancel }) {
  const isEditing = Boolean(bill)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    fundAllocationId: bill?.fundAllocation?._id || '',
    vendorName: bill?.vendorName || '',
    vendorGstNumber: bill?.vendorGstNumber || '',
    invoiceNumber: bill?.invoiceNumber || '',
    billDate: bill?.billDate ? new Date(bill.billDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    baseAmount: bill?.baseAmount || '',
    gstRate: bill?.gstRate || '18',
    gstAmount: bill?.gstAmount || '',
    totalAmount: bill?.totalAmount || '',
    description: bill?.description || '',
    billType: bill?.billType || 'material',
  })

  const [errors, setErrors] = useState({})

  const validateForm = () => {
    const newErrors = {}

    if (!form.fundAllocationId) newErrors.fundAllocationId = 'Fund allocation is required'
    if (!form.vendorName?.trim()) newErrors.vendorName = 'Vendor name is required'
    if (!form.baseAmount || parseFloat(form.baseAmount) <= 0) {
      newErrors.baseAmount = 'Valid base amount is required'
    }
    if (!form.billDate) newErrors.billDate = 'Bill date is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) return

    setSubmitting(true)
    try {
      const payload = {
        siteId: siteId,
        fundAllocationId: form.fundAllocationId,
        vendorName: form.vendorName,
        vendorGstNumber: form.vendorGstNumber,
        invoiceNumber: form.invoiceNumber,
        billDate: form.billDate,
        baseAmount: parseFloat(form.baseAmount),
        gstRate: parseInt(form.gstRate),
        gstAmount: parseFloat(form.gstAmount),
        totalAmount: parseFloat(form.totalAmount),
        description: form.description,
        billType: form.billType,
      }

      if (isEditing) {
        await billsApi.update(bill._id, payload)
      } else {
        await billsApi.create(payload)
      }

      onSuccess?.()
    } catch (error) {
      console.error('Failed to save bill:', error)
      if (error.response?.data?.message) {
        setErrors({ submit: error.response.data.message })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value }

      // Auto-calculate GST when base amount or GST rate changes
      if (field === 'baseAmount' || field === 'gstRate') {
        const base = parseFloat(field === 'baseAmount' ? value : updated.baseAmount) || 0
        const rate = parseFloat(field === 'gstRate' ? value : updated.gstRate) || 0
        const gst = (base * rate) / 100
        const total = base + gst

        updated.gstAmount = gst.toFixed(2)
        updated.totalAmount = total.toFixed(2)
      }

      return updated
    })

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Fund Allocation Selector */}
      <div className="space-y-2">
        <Label>
          Fund Allocation <span className="text-red-500">*</span>
        </Label>
        <FundAllocationSelector
          value={form.fundAllocationId}
          onChange={(value) => handleChange('fundAllocationId', value)}
          siteId={siteId}
          error={errors.fundAllocationId}
        />
        {errors.fundAllocationId && (
          <p className="text-sm text-red-500">{errors.fundAllocationId}</p>
        )}
      </div>

      {/* Vendor Name */}
      <div className="space-y-2">
        <Label htmlFor="vendorName">
          Vendor Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="vendorName"
          placeholder="Enter vendor name"
          value={form.vendorName}
          onChange={(e) => handleChange('vendorName', e.target.value)}
          className={errors.vendorName ? 'border-red-500' : ''}
        />
        {errors.vendorName && (
          <p className="text-sm text-red-500">{errors.vendorName}</p>
        )}
      </div>

      {/* Vendor GSTIN */}
      <div className="space-y-2">
        <Label htmlFor="vendorGstNumber">Vendor GSTIN</Label>
        <Input
          id="vendorGstNumber"
          placeholder="Enter GST number (optional)"
          value={form.vendorGstNumber}
          onChange={(e) => handleChange('vendorGstNumber', e.target.value)}
        />
      </div>

      {/* Invoice Number */}
      <div className="space-y-2">
        <Label htmlFor="invoiceNumber">Invoice Number</Label>
        <Input
          id="invoiceNumber"
          placeholder="Enter invoice number (optional)"
          value={form.invoiceNumber}
          onChange={(e) => handleChange('invoiceNumber', e.target.value)}
        />
      </div>

      {/* Base Amount */}
      <div className="space-y-2">
        <Label htmlFor="baseAmount">
          Base Amount (Before GST) <span className="text-red-500">*</span>
        </Label>
        <Input
          id="baseAmount"
          type="number"
          step="0.01"
          min="0"
          placeholder="Enter base amount"
          value={form.baseAmount}
          onChange={(e) => handleChange('baseAmount', e.target.value)}
          className={errors.baseAmount ? 'border-red-500' : ''}
        />
        {errors.baseAmount && (
          <p className="text-sm text-red-500">{errors.baseAmount}</p>
        )}
      </div>

      {/* GST Rate and Amount */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="gstRate">GST %</Label>
          <Select
            value={form.gstRate.toString()}
            onValueChange={(value) => handleChange('gstRate', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0%</SelectItem>
              <SelectItem value="5">5%</SelectItem>
              <SelectItem value="12">12%</SelectItem>
              <SelectItem value="18">18%</SelectItem>
              <SelectItem value="28">28%</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gstAmount">GST Amount</Label>
          <Input
            id="gstAmount"
            type="number"
            step="0.01"
            value={form.gstAmount}
            disabled
            className="bg-gray-50"
          />
        </div>
      </div>

      {/* Total Amount */}
      <div className="space-y-2">
        <Label htmlFor="totalAmount">Total Amount (Base + GST)</Label>
        <Input
          id="totalAmount"
          type="number"
          step="0.01"
          value={form.totalAmount}
          disabled
          className="bg-gray-50 font-bold text-lg"
        />
      </div>

      {/* Bill Type */}
      <div className="space-y-2">
        <Label htmlFor="billType">Bill Type</Label>
        <Select
          value={form.billType}
          onValueChange={(value) => handleChange('billType', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="material">Material</SelectItem>
            <SelectItem value="service">Service</SelectItem>
            <SelectItem value="labor">Labor</SelectItem>
            <SelectItem value="equipment">Equipment</SelectItem>
            <SelectItem value="utility">Utility</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Enter bill description (optional)"
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
        />
      </div>

      {/* Bill Date */}
      <div className="space-y-2">
        <Label htmlFor="billDate">
          Bill Date <span className="text-red-500">*</span>
        </Label>
        <Input
          id="billDate"
          type="date"
          value={form.billDate}
          onChange={(e) => handleChange('billDate', e.target.value)}
          className={errors.billDate ? 'border-red-500' : ''}
        />
        {errors.billDate && (
          <p className="text-sm text-red-500">{errors.billDate}</p>
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
            <>{isEditing ? 'Update Bill' : 'Add Bill'}</>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
