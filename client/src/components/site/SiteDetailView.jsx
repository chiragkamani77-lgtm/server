/**
 * SiteDetailView – reusable drill-down for a single site.
 * Works inside DeveloperHome, EngineerHome, or any role's page.
 *
 * Props:
 *   site      – site object (must have _id, name)
 *   onBack    – callback when back button is pressed
 *   canAdd    – boolean: show FAB / add forms (default true)
 */
import { useState, useEffect, useCallback } from 'react'
import { FeedItem, EmptyFeed } from '@/components/mobile'
import { TabStrip } from '@/components/mobile/TabStrip'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { ExpenseActions } from '@/components/expenses/ExpenseActions'
import { BillForm } from '@/components/bills/BillForm'
import { BillActions } from '@/components/bills/BillActions'
import {
  Receipt, FileText, Wallet, CalendarDays, BookOpen, Users,
  ChevronLeft, Plus, CheckCircle, XCircle, IndianRupee, Loader, Trash2,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  expensesApi, billsApi, fundsApi, attendanceApi, ledgerApi,
  sitesApi, usersApi,
} from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ─── Constants ────────────────────────────────────────────────────────────────

const SITE_STATUS_BADGE = {
  active:    'bg-green-100 text-green-700',
  completed: 'bg-slate-100 text-slate-600',
  on_hold:   'bg-amber-100 text-amber-700',
}

const EXPENSE_STATUS = {
  pending:  { label: 'Pending',  dot: 'bg-amber-400', text: 'text-amber-600' },
  approved: { label: 'Approved', dot: 'bg-blue-400',  text: 'text-blue-600'  },
  paid:     { label: 'Paid',     dot: 'bg-green-400', text: 'text-green-600' },
  rejected: { label: 'Rejected', dot: 'bg-red-400',   text: 'text-red-500'   },
}

const BILL_STATUS = {
  pending:  'bg-amber-100 text-amber-700',
  credited: 'bg-blue-100 text-blue-700',
  paid:     'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const ATTENDANCE_BADGE = {
  present:  'bg-green-100 text-green-700',
  absent:   'bg-red-100 text-red-700',
  half_day: 'bg-amber-100 text-amber-700',
  leave:    'bg-blue-100 text-blue-700',
}

const ROLE_LABELS = { 1: 'Developer', 2: 'Engineer', 3: 'Supervisor', 4: 'Worker' }
const ROLE_BADGE_CLS = {
  1: 'bg-purple-100 text-purple-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-teal-100 text-teal-700',
  4: 'bg-gray-100 text-gray-700',
}
const PAYMENT_MODES = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi',           label: 'UPI' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'other',         label: 'Other' },
]

const SUB_TABS = [
  { id: 'expenses',   label: 'Expenses',   icon: Receipt },
  { id: 'bills',      label: 'Bills',      icon: FileText },
  { id: 'funds',      label: 'Funds',      icon: Wallet },
  { id: 'attendance', label: 'Attendance', icon: CalendarDays },
  { id: 'ledger',     label: 'Ledger',     icon: BookOpen },
  { id: 'members',    label: 'Members',    icon: Users },
]
const FAB_LABELS = {
  expenses:   'Add Expense',
  bills:      'Add Bill',
  funds:      'Allocate Fund',
  attendance: 'Mark Attendance',
  ledger:     'Pay Worker',
  members:    'Add Member',
}
const SUBTAB_TO_FORM = {
  expenses: 'expense', bills: 'bill',
  funds: 'fund', attendance: 'attendance', ledger: 'ledger',
  members: 'member',
}
const TODAY = new Date().toISOString().split('T')[0]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusMeta({ status }) {
  const s = EXPENSE_STATUS[status] || { dot: 'bg-gray-400', text: 'text-gray-500', label: status }
  return (
    <div className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span className={`text-[10px] font-medium ${s.text}`}>{s.label}</span>
    </div>
  )
}

function TabLoader() {
  return (
    <div className="flex justify-center py-16">
      <Loader className="h-6 w-6 animate-spin text-gray-300" />
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SiteDetailView({ site, onBack, canAdd = true }) {
  const { toast } = useToast()

  const [subTab, setSubTab] = useState('expenses')
  const [loading, setLoading] = useState(false)

  const [expenses,   setExpenses]   = useState([])
  const [bills,      setBills]      = useState([])
  const [funds,      setFunds]      = useState([])
  const [attendance, setAttendance] = useState([])
  const [ledger,     setLedger]     = useState([])
  const [members,    setMembers]    = useState([])
  const [allWorkers,        setAllWorkers]        = useState([])
  const [allUsers,          setAllUsers]          = useState([])
  const [assignedElsewhere, setAssignedElsewhere] = useState(new Set())

  const [sheetOpen,     setSheetOpen]     = useState(false)
  const [activeForm,    setActiveForm]    = useState('expense')
  const [editItem,      setEditItem]      = useState(null)
  const [approveExpense, setApproveExpense] = useState(null)
  const [approveAction,  setApproveAction] = useState('approve')
  const [approveBill,    setApproveBill]   = useState(null)
  const [billAction,     setBillAction]    = useState('approve')

  // Forms
  const [attendForm, setAttendForm] = useState({ workerId: '', date: TODAY, status: 'present', hoursWorked: '8', notes: '' })
  const [ledgerForm, setLedgerForm] = useState({ amount: '', workerId: '', paymentMode: 'cash', description: '', transactionDate: TODAY })
  const ledgerAmountEntered = parseFloat(ledgerForm.amount) > 0
  const [fundsForm,  setFundsForm]  = useState({ amount: '', toUserId: '', description: '', referenceNumber: '' })
  const fundsAmountEntered = parseFloat(fundsForm.amount) > 0
  const [memberForm, setMemberForm] = useState({ userId: '' })

  // ── Load all site data ──

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [expRes, billsRes, fundsRes, attendRes, ledgerRes, siteRes] = await Promise.all([
        expensesApi.getAll({ siteId: site._id, limit: 50 }),
        billsApi.getAll({ siteId: site._id, limit: 50 }),
        fundsApi.getAll({ limit: 50 }),
        attendanceApi.getAll({ limit: 100 }),
        ledgerApi.getAll({ limit: 100 }),
        sitesApi.getOne(site._id),
      ])
      const siteMembers = siteRes.data?.assignedUsers || site.assignedUsers || []
      const memberIds = new Set(siteMembers.map(m => (m._id || m).toString()))

      setExpenses(expRes.data?.expenses || [])
      setBills(billsRes.data?.bills || [])
      setFunds(fundsRes.data?.allocations || [])
      setMembers(siteMembers)
      setAttendance((attendRes.data?.attendance || []).filter(a =>
        memberIds.has((a.worker?._id || a.worker)?.toString())
      ))
      setLedger((ledgerRes.data?.entries || []).filter(e =>
        memberIds.has((e.worker?._id || e.worker)?.toString())
      ))
    } catch {
      toast({ title: 'Error', description: 'Failed to load site data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [site._id, site.assignedUsers, toast])

  useEffect(() => {
    loadData()
    Promise.all([usersApi.getAll(), sitesApi.getAll()]).then(([usersRes, sitesRes]) => {
      const all = usersRes.data || []
      const elsewhere = new Set()
      ;(sitesRes.data || []).forEach(s => {
        if (s._id !== site._id) {
          (s.assignedUsers || []).forEach(u => elsewhere.add((u._id || u).toString()))
        }
      })
      setAssignedElsewhere(elsewhere)
      setAllWorkers(all.filter(u => u.role >= 3))
      setAllUsers(all.filter(u => u.role >= 2))
    }).catch(() => {})
  }, [loadData, site._id])

  // ── Form handlers ──

  const closeSheet = () => {
    setSheetOpen(false)
    setEditItem(null)
    setAttendForm({ workerId: '', date: TODAY, status: 'present', hoursWorked: '8', notes: '' })
    setLedgerForm({ amount: '', workerId: '', paymentMode: 'cash', description: '', transactionDate: TODAY })
    setFundsForm({ amount: '', toUserId: '', description: '', referenceNumber: '' })
    setMemberForm({ userId: '' })
  }

  const handleMemberAdd = async (e) => {
    e.preventDefault()
    try {
      await sitesApi.assign(site._id, memberForm.userId)
      toast({ title: 'Member added' }); closeSheet(); loadData()
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' }) }
  }

  const handleMemberRemove = async (userId) => {
    try {
      await sitesApi.unassign(site._id, userId)
      toast({ title: 'Member removed' }); loadData()
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' }) }
  }

  const openForm = (tab) => {
    setEditItem(null)
    setActiveForm(SUBTAB_TO_FORM[tab] || 'expense')
    setSheetOpen(true)
  }

  const openEdit = (tab, item) => {
    setEditItem(item)
    setActiveForm(SUBTAB_TO_FORM[tab] || tab)
    if (tab === 'attendance') {
      setAttendForm({
        workerId: item.worker?._id || item.worker || '',
        date: item.date ? new Date(item.date).toISOString().split('T')[0] : TODAY,
        status: item.status || 'present',
        hoursWorked: String(item.hoursWorked || '8'),
        notes: item.notes || '',
      })
    }
    if (tab === 'ledger') {
      setLedgerForm({
        amount: String(item.amount || ''),
        workerId: item.worker?._id || item.worker || '',
        paymentMode: item.paymentMode || 'cash',
        description: item.description || '',
        transactionDate: item.transactionDate ? new Date(item.transactionDate).toISOString().split('T')[0] : TODAY,
      })
    }
    setSheetOpen(true)
  }

  const handleAttendSubmit = async (e) => {
    e.preventDefault()
    try {
      const hrs = attendForm.status === 'present' ? parseFloat(attendForm.hoursWorked)
        : attendForm.status === 'half_day' ? 4 : 0
      const payload = { workerId: attendForm.workerId, date: attendForm.date, status: attendForm.status, hoursWorked: hrs, notes: attendForm.notes }
      if (editItem) await attendanceApi.update(editItem._id, payload)
      else await attendanceApi.create(payload)
      toast({ title: editItem ? 'Attendance updated' : 'Attendance recorded' }); closeSheet(); loadData()
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' }) }
  }

  const handleLedgerSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = { workerId: ledgerForm.workerId, amount: parseFloat(ledgerForm.amount), type: 'credit', paymentMode: ledgerForm.paymentMode, description: ledgerForm.description, transactionDate: ledgerForm.transactionDate }
      if (editItem) await ledgerApi.update(editItem._id, payload)
      else await ledgerApi.create(payload)
      toast({ title: editItem ? 'Payment updated' : 'Payment recorded' }); closeSheet(); loadData()
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' }) }
  }

  const handleFundsSubmit = async (e) => {
    e.preventDefault()
    try {
      await fundsApi.create({ toUserId: fundsForm.toUserId, amount: parseFloat(fundsForm.amount), description: fundsForm.description, referenceNumber: fundsForm.referenceNumber })
      toast({ title: 'Fund allocated' }); closeSheet(); loadData()
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' }) }
  }

  // Workers for attendance/ledger (role >= 3)
  const workers = members.filter(m => m.role >= 3).length > 0
    ? members.filter(m => m.role >= 3)
    : allWorkers

  // Fund recipients: engineers + supervisors (role 2–3)
  const fundRecipients = members.filter(m => m.role >= 2 && m.role <= 3).length > 0
    ? members.filter(m => m.role >= 2 && m.role <= 3)
    : allUsers.filter(u => u.role >= 2 && u.role <= 3)

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="min-h-full">
        {/* Back header */}
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="text-gray-500 -ml-1 p-1 rounded-full hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{site.name}</p>
            {(site.location || site.address) && (
              <p className="text-xs text-gray-400 truncate">{site.location || site.address}</p>
            )}
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${SITE_STATUS_BADGE[site.status] || 'bg-gray-100 text-gray-600'}`}>
            {site.status?.replace('_', ' ')}
          </span>
        </div>

        {/* Sub-tabs — same style as main navbar */}
        <TabStrip tabs={SUB_TABS} activeTab={subTab} onChange={setSubTab} />

        {/* Content */}
        {loading ? <TabLoader /> : (
          <div className="pb-24">
            {/* ── Expenses ── */}
            {subTab === 'expenses' && (
              expenses.length === 0
                ? <EmptyFeed icon={Receipt} message="No expenses for this site"
                    action={canAdd ? { label: '+ Add expense', onClick: () => openForm('expenses') } : undefined} />
                : <div className="divide-y divide-gray-100 bg-white">
                    {expenses.map(exp => (
                      <div key={exp._id}>
                        <FeedItem seed={exp.description || 'E'} title={exp.description || '—'}
                          subtitle={[exp.user?.name, formatDate(exp.expenseDate)].filter(Boolean).join(' · ')}
                          meta={<StatusMeta status={exp.status} />}
                          amount={formatCurrency(exp.requestedAmount || exp.amount)}
                          onClick={canAdd ? () => openEdit('expenses', exp) : undefined} />
                        {exp.status === 'pending' && (
                          <div className="px-4 pb-3 flex gap-2 flex-wrap">
                            <button onClick={() => { setApproveExpense(exp); setApproveAction('approve') }} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">
                              <CheckCircle className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button onClick={() => { setApproveExpense(exp); setApproveAction('reject') }} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 text-red-500 text-xs font-semibold">
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        )}
                        {exp.status === 'approved' && (
                          <div className="px-4 pb-3">
                            <button onClick={() => { setApproveExpense(exp); setApproveAction('pay') }} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                              <IndianRupee className="h-3.5 w-3.5" /> Mark Paid
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
            )}

            {/* ── Bills ── */}
            {subTab === 'bills' && (
              bills.length === 0
                ? <EmptyFeed icon={FileText} message="No bills for this site"
                    action={canAdd ? { label: '+ Add bill', onClick: () => openForm('bills') } : undefined} />
                : <div className="divide-y divide-gray-100 bg-white">
                    {bills.map(bill => (
                      <div key={bill._id}>
                        <FeedItem seed={bill.vendorName || 'B'} title={bill.vendorName || '—'}
                          subtitle={[bill.invoiceNumber, formatDate(bill.billDate)].filter(Boolean).join(' · ')}
                          amount={formatCurrency(bill.totalAmount)}
                          badge={{ label: bill.status, className: BILL_STATUS[bill.status] || 'bg-gray-100 text-gray-600' }}
                          onClick={canAdd ? () => openEdit('bills', bill) : undefined} />
                        {bill.status === 'pending' && (
                          <div className="px-4 pb-3 flex gap-2">
                            <button onClick={() => { setApproveBill(bill); setBillAction('credit') }} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">
                              <CheckCircle className="h-3.5 w-3.5" /> Credit
                            </button>
                            <button onClick={() => { setApproveBill(bill); setBillAction('reject') }} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 text-red-500 text-xs font-semibold">
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        )}
                        {bill.status === 'credited' && (
                          <div className="px-4 pb-3">
                            <button onClick={() => { setApproveBill(bill); setBillAction('pay') }} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                              <IndianRupee className="h-3.5 w-3.5" /> Mark Paid
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
            )}

            {/* ── Funds ── */}
            {subTab === 'funds' && (
              funds.length === 0
                ? <EmptyFeed icon={Wallet} message="No fund allocations"
                    action={canAdd ? { label: '+ Allocate fund', onClick: () => openForm('funds') } : undefined} />
                : <div className="divide-y divide-gray-100 bg-white">
                    {funds.map(fund => {
                      const name = fund.toUser?.name || '—'
                      return (
                        <FeedItem key={fund._id} seed={name} title={name}
                          subtitle={[fund.fromUser?.name && `From: ${fund.fromUser.name}`, formatDate(fund.allocationDate || fund.createdAt)].filter(Boolean).join(' · ')}
                          amount={formatCurrency(fund.amount)}
                          badge={{ label: fund.status, className: fund.status === 'disbursed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700' }} />
                      )
                    })}
                  </div>
            )}

            {/* ── Attendance ── */}
            {subTab === 'attendance' && (
              attendance.length === 0
                ? <EmptyFeed icon={CalendarDays} message="No attendance records"
                    action={canAdd ? { label: '+ Mark attendance', onClick: () => openForm('attendance') } : undefined} />
                : <div className="divide-y divide-gray-100 bg-white">
                    {attendance.map(rec => {
                      const name = rec.worker?.name || '—'
                      return (
                        <FeedItem key={rec._id} seed={name} title={name}
                          subtitle={[formatDate(rec.date), rec.hoursWorked > 0 && `${rec.hoursWorked}h`].filter(Boolean).join(' · ')}
                          badge={{ label: rec.status?.replace('_', ' '), className: ATTENDANCE_BADGE[rec.status] || 'bg-gray-100 text-gray-600' }}
                          onClick={canAdd ? () => openEdit('attendance', rec) : undefined} />
                      )
                    })}
                  </div>
            )}

            {/* ── Ledger ── */}
            {subTab === 'ledger' && (
              ledger.length === 0
                ? <EmptyFeed icon={BookOpen} message="No payments recorded"
                    action={canAdd ? { label: '+ Pay worker', onClick: () => openForm('ledger') } : undefined} />
                : <div className="divide-y divide-gray-100 bg-white">
                    {ledger.map(entry => {
                      const name = entry.worker?.name || '—'
                      return (
                        <FeedItem key={entry._id} seed={name} title={name}
                          subtitle={[formatDate(entry.transactionDate), entry.paymentMode?.replace('_', ' ')].filter(Boolean).join(' · ')}
                          amount={`${entry.type === 'credit' ? '+' : '−'}${formatCurrency(entry.amount)}`}
                          amountClass={entry.type === 'credit' ? 'text-green-600' : 'text-red-500'}
                          onClick={canAdd ? () => openEdit('ledger', entry) : undefined} />
                      )
                    })}
                  </div>
            )}

            {/* ── Members ── */}
            {subTab === 'members' && (
              members.length === 0
                ? <EmptyFeed icon={Users} message="No members assigned to this site"
                    action={canAdd ? { label: '+ Add Member', onClick: () => openForm('members') } : undefined} />
                : <div className="divide-y divide-gray-100 bg-white">
                    {members.map(member => {
                      const mid = member._id?.toString()
                      const fullUser = allUsers.find(u => u._id?.toString() === mid)
                      const walletBalance = fullUser?.walletBalance ?? member.walletBalance ?? 0
                      return (
                      <div key={member._id} className="flex items-center pr-3">
                        <div className="flex-1 min-w-0">
                          <FeedItem seed={member.name} title={member.name}
                            subtitle={member.email || member.phone || '—'}
                            amount={formatCurrency(walletBalance)}
                            amountClass={walletBalance >= 0 ? 'text-green-600' : 'text-red-500'}
                            badge={{ label: ROLE_LABELS[member.role] || `Role ${member.role}`, className: ROLE_BADGE_CLS[member.role] || 'bg-gray-100 text-gray-600' }} />
                        </div>
                        {canAdd && (
                          <button onClick={() => handleMemberRemove(member._id)}
                            className="shrink-0 p-2 text-red-400 hover:text-red-600 rounded-full hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      )
                    })}
                  </div>
            )}
          </div>
        )}

        {/* FAB */}
        {canAdd && (
          <button
            onClick={() => openForm(subTab)}
            className="fixed bottom-24 right-4 z-30 h-14 w-14 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg"
            aria-label={FAB_LABELS[subTab] || 'Add'}
          >
            <Plus className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* ── Add forms sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) closeSheet() }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-0 pb-safe">
          <div className="px-5 pt-2 pb-6">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editItem ? `Edit ${FAB_LABELS[subTab]?.replace('Add ', '').replace('Mark ', '').replace('Pay ', '').replace('Allocate ', '') || 'Record'}` : (FAB_LABELS[subTab] || 'Add')}
            </h2>

            {activeForm === 'expense' && (
              <ExpenseForm expense={editItem} siteId={site._id} hideSite
                onSuccess={() => { closeSheet(); toast({ title: editItem ? 'Expense updated!' : 'Expense submitted!' }); loadData() }}
                onCancel={closeSheet} />
            )}

            {activeForm === 'bill' && (
              <BillForm bill={editItem} siteId={site._id}
                onSuccess={() => { closeSheet(); toast({ title: editItem ? 'Bill updated!' : 'Bill added!' }); loadData() }}
                onCancel={closeSheet} />
            )}

            {activeForm === 'attendance' && (
              <form onSubmit={handleAttendSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Worker *</Label>
                  <Select value={attendForm.workerId} onValueChange={v => setAttendForm(p => ({ ...p, workerId: v }))} required>
                    <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                    <SelectContent>
                      {workers.map(w => <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Status *</Label>
                    <Select value={attendForm.status} onValueChange={v => setAttendForm(p => ({ ...p, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                        <SelectItem value="half_day">Half Day</SelectItem>
                        <SelectItem value="leave">Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date *</Label>
                    <Input type="date" value={attendForm.date} onChange={e => setAttendForm(p => ({ ...p, date: e.target.value }))} required />
                  </div>
                </div>
                {attendForm.status === 'present' && (
                  <div className="space-y-1.5">
                    <Label>Hours Worked</Label>
                    <Input type="number" value={attendForm.hoursWorked} onChange={e => setAttendForm(p => ({ ...p, hoursWorked: e.target.value }))} min="0" max="24" step="0.5" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Input placeholder="Optional" value={attendForm.notes} onChange={e => setAttendForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!attendForm.workerId}>Save</Button>
                  <Button type="button" variant="outline" onClick={closeSheet}>Cancel</Button>
                </div>
              </form>
            )}

            {activeForm === 'ledger' && (
              <form onSubmit={handleLedgerSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Amount (₹) *</Label>
                  <Input type="number" placeholder="e.g. 2500" autoFocus value={ledgerForm.amount} onChange={e => setLedgerForm(p => ({ ...p, amount: e.target.value }))} min="0" required />
                </div>
                {ledgerAmountEntered && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Worker *</Label>
                      <Select value={ledgerForm.workerId} onValueChange={v => setLedgerForm(p => ({ ...p, workerId: v }))} required>
                        <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                        <SelectContent>
                          {workers.map(w => <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Payment Mode</Label>
                        <Select value={ledgerForm.paymentMode} onValueChange={v => setLedgerForm(p => ({ ...p, paymentMode: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Date</Label>
                        <Input type="date" value={ledgerForm.transactionDate} onChange={e => setLedgerForm(p => ({ ...p, transactionDate: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Note</Label>
                      <Input placeholder="e.g. Weekly wages" value={ledgerForm.description} onChange={e => setLedgerForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                  </>
                )}
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!ledgerAmountEntered || !ledgerForm.workerId}>Save</Button>
                  <Button type="button" variant="outline" onClick={closeSheet}>Cancel</Button>
                </div>
              </form>
            )}

            {activeForm === 'member' && (
              <form onSubmit={handleMemberAdd} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Select User *</Label>
                  <Select value={memberForm.userId} onValueChange={v => setMemberForm({ userId: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose a team member" /></SelectTrigger>
                    <SelectContent>
                      {allUsers
                        .filter(u => !members.some(m => m._id === u._id) && !assignedElsewhere.has(u._id.toString()))
                        .map(u => (
                          <SelectItem key={u._id} value={u._id}>
                            {u.name} — {ROLE_LABELS[u.role] || `Role ${u.role}`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!memberForm.userId}>Add to Site</Button>
                  <Button type="button" variant="outline" onClick={closeSheet}>Cancel</Button>
                </div>
              </form>
            )}

            {activeForm === 'fund' && (
              <form onSubmit={handleFundsSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Amount (₹) *</Label>
                  <Input type="number" placeholder="e.g. 50000" autoFocus value={fundsForm.amount} onChange={e => setFundsForm(p => ({ ...p, amount: e.target.value }))} min="0" required />
                </div>
                {fundsAmountEntered && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Allocate To (Engineer / Supervisor) *</Label>
                      <Select value={fundsForm.toUserId} onValueChange={v => setFundsForm(p => ({ ...p, toUserId: v }))} required>
                        <SelectTrigger><SelectValue placeholder="Select recipient" /></SelectTrigger>
                        <SelectContent>
                          {fundRecipients.map(u => (
                            <SelectItem key={u._id} value={u._id}>
                              {u.name} — {ROLE_LABELS[u.role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Reference #</Label>
                      <Input placeholder="e.g. TRF-001" value={fundsForm.referenceNumber} onChange={e => setFundsForm(p => ({ ...p, referenceNumber: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <Input placeholder="Optional" value={fundsForm.description} onChange={e => setFundsForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                  </>
                )}
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!fundsAmountEntered || !fundsForm.toUserId}>Allocate</Button>
                  <Button type="button" variant="outline" onClick={closeSheet}>Cancel</Button>
                </div>
              </form>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Approve dialogs */}
      {approveExpense && (
        <ExpenseActions expense={approveExpense} isOpen={!!approveExpense}
          onClose={() => setApproveExpense(null)}
          onSuccess={() => { setApproveExpense(null); loadData() }}
          action={approveAction} />
      )}
      {approveBill && (
        <BillActions bill={approveBill} isOpen={!!approveBill}
          onClose={() => setApproveBill(null)}
          onSuccess={() => { setApproveBill(null); loadData() }}
          action={billAction} />
      )}
    </>
  )
}
