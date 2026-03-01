import { useState, useEffect } from 'react'
import { billsApi, fundsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { Loader, Wallet } from 'lucide-react'

export function BillForm({ bill = null, siteId, onSuccess, onCancel }) {
  const isEditing = Boolean(bill)
  const [submitting, setSubmitting] = useState(false)
  const [walletBalance, setWalletBalance] = useState(null)

  const [form, setForm] = useState({
    vendorName: bill?.vendorName || '',
    vendorGstNumber: bill?.vendorGstNumber || '',
    invoiceNumber: bill?.invoiceNumber || '',
    billDate: bill?.billDate
      ? new Date(bill.billDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    baseAmount: bill?.baseAmount || '',
    gstRate: bill?.gstRate?.toString() || '18',
    gstAmount: bill?.gstAmount || '',
    totalAmount: bill?.totalAmount || '',
    description: bill?.description || '',
    billType: bill?.billType || 'material',
  })

  const [errors, setErrors] = useState({})
  const baseAmountEntered = parseFloat(form.baseAmount) > 0

  useEffect(() => {
    fundsApi.getWalletSummary().then((r) => setWalletBalance(r.data)).catch(() => null)
  }, [])

  const validateForm = () => {
    const newErrors = {}
    if (!form.baseAmount || parseFloat(form.baseAmount) <= 0) newErrors.baseAmount = 'Valid base amount is required'
    if (!form.vendorName?.trim()) newErrors.vendorName = 'Vendor name is required'
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
        siteId,
        vendorName: form.vendorName,
        vendorGstNumber: form.vendorGstNumber,
        invoiceNumber: form.invoiceNumber,
        billDate: form.billDate,
        baseAmount: parseFloat(form.baseAmount),
        gstRate: parseInt(form.gstRate),
        gstAmount: parseFloat(form.gstAmount) || 0,
        totalAmount: parseFloat(form.totalAmount) || parseFloat(form.baseAmount),
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
      if (error.response?.data?.message) setErrors({ submit: error.response.data.message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value }
      if (field === 'baseAmount' || field === 'gstRate') {
        const base = parseFloat(field === 'baseAmount' ? value : updated.baseAmount) || 0
        const rate = parseFloat(field === 'gstRate' ? value : updated.gstRate) || 0
        const gst = (base * rate) / 100
        updated.gstAmount = gst.toFixed(2)
        updated.totalAmount = (base + gst).toFixed(2)
      }
      return updated
    })
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Wallet balance (read-only info) */}
      {walletBalance && (
        <div className="flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5 text-indigo-700 font-medium">
            <Wallet className="h-4 w-4" />
            Available Balance
          </span>
          <span className={`font-bold ${walletBalance.remainingBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {formatCurrency(walletBalance.remainingBalance)}
          </span>
        </div>
      )}

      {/* Base Amount — shown first */}
      <div className="space-y-2">
        <Label htmlFor="baseAmount">Base Amount (Before GST) <span className="text-red-500">*</span></Label>
        <Input
          id="baseAmount"
          type="number"
          step="0.01"
          min="0"
          placeholder="Enter base amount"
          value={form.baseAmount}
          onChange={(e) => handleChange('baseAmount', e.target.value)}
          className={errors.baseAmount ? 'border-red-500' : ''}
          autoFocus
        />
        {errors.baseAmount && <p className="text-sm text-red-500">{errors.baseAmount}</p>}
      </div>

      {/* Rest of form — shown after base amount entered */}
      {baseAmountEntered && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>GST %</Label>
              <Select value={form.gstRate} onValueChange={(v) => handleChange('gstRate', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>GST Amount</Label>
              <Input type="number" step="0.01" value={form.gstAmount} disabled className="bg-gray-50" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Total Amount</Label>
            <Input type="number" step="0.01" value={form.totalAmount} disabled className="bg-gray-50 font-semibold" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendorName">Vendor Name <span className="text-red-500">*</span></Label>
            <Input
              id="vendorName"
              placeholder="Enter vendor name"
              value={form.vendorName}
              onChange={(e) => handleChange('vendorName', e.target.value)}
              className={errors.vendorName ? 'border-red-500' : ''}
            />
            {errors.vendorName && <p className="text-sm text-red-500">{errors.vendorName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendorGstNumber">Vendor GSTIN</Label>
            <Input
              id="vendorGstNumber"
              placeholder="GST number (optional)"
              value={form.vendorGstNumber}
              onChange={(e) => handleChange('vendorGstNumber', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Invoice Number</Label>
            <Input
              id="invoiceNumber"
              placeholder="Invoice number (optional)"
              value={form.invoiceNumber}
              onChange={(e) => handleChange('invoiceNumber', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Bill Type</Label>
            <Select value={form.billType} onValueChange={(v) => handleChange('billType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Bill description (optional)"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="billDate">Bill Date <span className="text-red-500">*</span></Label>
            <Input
              id="billDate"
              type="date"
              value={form.billDate}
              onChange={(e) => handleChange('billDate', e.target.value)}
              className={errors.billDate ? 'border-red-500' : ''}
            />
            {errors.billDate && <p className="text-sm text-red-500">{errors.billDate}</p>}
          </div>
        </>
      )}

      {errors.submit && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{errors.submit}</div>
      )}

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={submitting || !baseAmountEntered} className="flex-1">
          {submitting ? (
            <><Loader className="mr-2 h-4 w-4 animate-spin" />{isEditing ? 'Updating...' : 'Saving...'}</>
          ) : (
            <>{isEditing ? 'Update Bill' : 'Add Bill'}</>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
