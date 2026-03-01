import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { MobileLayout, FeedItem, EmptyFeed } from '@/components/mobile'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { ExpenseActions } from '@/components/expenses/ExpenseActions'
import { BillForm } from '@/components/bills/BillForm'
import { BillActions } from '@/components/bills/BillActions'
import {
  LayoutDashboard, Building2, Receipt, FileText, TrendingUp,
  Wallet, CalendarDays, BookOpen, Users, BarChart2, Loader,
  CheckCircle, XCircle, IndianRupee, PiggyBank,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  expensesApi, sitesApi, fundsApi, usersApi,
  attendanceApi, ledgerApi, reportsApi, billsApi,
  investmentsApi, organizationsApi,
} from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',     label: 'Overview',     icon: LayoutDashboard },
  { id: 'sites',        label: 'Sites',        icon: Building2 },
  { id: 'expenses',     label: 'Expenses',     icon: Receipt },
  { id: 'bills',        label: 'Bills',        icon: FileText },
  { id: 'investments',  label: 'Investments',  icon: TrendingUp },
  { id: 'funds',        label: 'Funds',        icon: Wallet },
  { id: 'attendance',   label: 'Attendance',   icon: CalendarDays },
  { id: 'ledger',       label: 'Ledger',       icon: BookOpen },
  { id: 'users',        label: 'Users',        icon: Users },
  { id: 'reports',      label: 'Reports',      icon: BarChart2 },
]

// ─── Status maps ──────────────────────────────────────────────────────────────

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
const SITE_STATUS_BADGE = {
  active:    'bg-green-100 text-green-700',
  completed: 'bg-slate-100 text-slate-600',
  on_hold:   'bg-amber-100 text-amber-700',
}
const ROLE_LABELS   = { 1: 'Developer', 2: 'Engineer', 3: 'Supervisor', 4: 'Worker' }
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

const TODAY = new Date().toISOString().split('T')[0]

// ─── Shared small components ──────────────────────────────────────────────────

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
  return <div className="flex justify-center py-16"><Loader className="h-6 w-6 animate-spin text-gray-300" /></div>
}

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    amber:  'bg-amber-50 text-amber-700',
    slate:  'bg-slate-100 text-slate-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    teal:   'bg-teal-50 text-teal-700',
    rose:   'bg-rose-50 text-rose-700',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color] || colors.blue}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      {sub && <p className="text-[11px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

// Inline approve/reject/pay action row
function ExpenseActions_({ exp, onAction }) {
  if (exp.status === 'pending') {
    return (
      <div className="px-4 pb-3 flex gap-2 flex-wrap">
        <button onClick={() => onAction(exp, 'approve')} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">
          <CheckCircle className="h-3.5 w-3.5" /> Approve
        </button>
        <button onClick={() => onAction(exp, 'reject')} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 text-red-500 text-xs font-semibold">
          <XCircle className="h-3.5 w-3.5" /> Reject
        </button>
      </div>
    )
  }
  if (exp.status === 'approved') {
    return (
      <div className="px-4 pb-3 flex gap-2">
        <button onClick={() => onAction(exp, 'pay')} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
          <IndianRupee className="h-3.5 w-3.5" /> Mark Paid
        </button>
      </div>
    )
  }
  return null
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DeveloperHome() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState('overview')
  const [allUsers, setAllUsers] = useState([])
  const [partners, setPartners] = useState([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [wallet, setWallet] = useState(null)

  // Approval dialogs
  const [approveExpense, setApproveExpense] = useState(null)
  const [approveAction, setApproveAction] = useState('approve')
  const [approveBill, setApproveBill]       = useState(null)
  const [billAction, setBillAction]         = useState('approve')

  // Per-tab state
  const [summary,          setSummary]          = useState(null)
  const [summaryLoading,   setSummaryLoading]   = useState(false)
  const [sites,            setSites]            = useState([])
  const [sitesLoading,     setSitesLoading]     = useState(false)
  const [expenses,         setExpenses]         = useState([])
  const [expensesLoading,  setExpensesLoading]  = useState(false)
  const [bills,            setBills]            = useState([])
  const [billsLoading,     setBillsLoading]     = useState(false)
  const [investments,      setInvestments]      = useState([])
  const [investSummary,    setInvestSummary]    = useState(null)
  const [investLoading,    setInvestLoading]    = useState(false)
  const [funds,            setFunds]            = useState([])
  const [fundsLoading,     setFundsLoading]     = useState(false)
  const [attendance,       setAttendance]       = useState([])
  const [attendanceLoading,setAttendanceLoading]= useState(false)
  const [ledger,           setLedger]           = useState([])
  const [ledgerLoading,    setLedgerLoading]    = useState(false)
  const [users,            setUsers]            = useState([])
  const [usersLoading,     setUsersLoading]     = useState(false)
  const [poolSummary,      setPoolSummary]      = useState(null)
  const [reportsLoading,   setReportsLoading]   = useState(false)

  useEffect(() => {
    fundsApi.getWalletSummary().then(r => setWallet(r.data)).catch(() => {})
  }, [])

  // Forms
  const [fundsForm, setFundsForm] = useState({ amount: '', toUserId: '', description: '', referenceNumber: '' })
  const fundsAmountEntered = parseFloat(fundsForm.amount) > 0

  const [attendanceForm, setAttendanceForm] = useState({
    workerId: '', date: TODAY, status: 'present', hoursWorked: '8', notes: '',
  })

  const [ledgerForm, setLedgerForm] = useState({
    amount: '', workerId: '', paymentMode: 'cash', description: '', transactionDate: TODAY,
  })
  const ledgerAmountEntered = parseFloat(ledgerForm.amount) > 0

  const [investForm, setInvestForm] = useState({
    amount: '', partnerId: '', description: '', investmentDate: TODAY, paymentMode: 'bank_transfer', referenceNumber: '',
  })
  const investAmountEntered = parseFloat(investForm.amount) > 0

  // ── Bootstrap ──

  useEffect(() => {
    usersApi.getAll().then(r => setAllUsers(r.data || [])).catch(() => {})
    organizationsApi.getCurrent()
      .then(r => r.data?._id ? organizationsApi.getPartners(r.data._id) : null)
      .then(r => setPartners(r?.data || []))
      .catch(() => {})
  }, [])

  // ── Data loaders ──

  const loadOverview = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const [sitesRes, sumRes] = await Promise.all([sitesApi.getAll(), reportsApi.getSummary()])
      setSites(sitesRes.data || [])
      setSummary(sumRes.data)
    } catch { toast({ title: 'Error', description: 'Failed to load overview', variant: 'destructive' }) }
    finally { setSummaryLoading(false) }
  }, [toast])

  const loadSites = useCallback(async () => {
    setSitesLoading(true)
    try { setSites((await sitesApi.getAll()).data || []) }
    catch { toast({ title: 'Error', description: 'Failed to load sites', variant: 'destructive' }) }
    finally { setSitesLoading(false) }
  }, [toast])

  const loadExpenses = useCallback(async () => {
    setExpensesLoading(true)
    try { setExpenses((await expensesApi.getAll({ limit: 50 })).data?.expenses || []) }
    catch { toast({ title: 'Error', description: 'Failed to load expenses', variant: 'destructive' }) }
    finally { setExpensesLoading(false) }
  }, [toast])

  const loadBills = useCallback(async () => {
    setBillsLoading(true)
    try { setBills((await billsApi.getAll({ limit: 50 })).data?.bills || []) }
    catch { toast({ title: 'Error', description: 'Failed to load bills', variant: 'destructive' }) }
    finally { setBillsLoading(false) }
  }, [toast])

  const loadInvestments = useCallback(async () => {
    setInvestLoading(true)
    try {
      const [invRes, sumRes] = await Promise.all([investmentsApi.getAll({ limit: 30 }), investmentsApi.getSummary()])
      setInvestments(invRes.data?.investments || invRes.data || [])
      setInvestSummary(sumRes.data)
    } catch { toast({ title: 'Error', description: 'Failed to load investments', variant: 'destructive' }) }
    finally { setInvestLoading(false) }
  }, [toast])

  const loadFunds = useCallback(async () => {
    setFundsLoading(true)
    try { setFunds((await fundsApi.getAll({ limit: 50 })).data?.allocations || []) }
    catch { toast({ title: 'Error', description: 'Failed to load funds', variant: 'destructive' }) }
    finally { setFundsLoading(false) }
  }, [toast])

  const loadAttendance = useCallback(async () => {
    setAttendanceLoading(true)
    try { setAttendance((await attendanceApi.getAll({ limit: 50 })).data?.attendance || []) }
    catch { toast({ title: 'Error', description: 'Failed to load attendance', variant: 'destructive' }) }
    finally { setAttendanceLoading(false) }
  }, [toast])

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true)
    try { setLedger((await ledgerApi.getAll({ limit: 50 })).data?.entries || []) }
    catch { toast({ title: 'Error', description: 'Failed to load ledger', variant: 'destructive' }) }
    finally { setLedgerLoading(false) }
  }, [toast])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try { setUsers((await usersApi.getAll()).data || []) }
    catch { toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' }) }
    finally { setUsersLoading(false) }
  }, [toast])

  const loadReports = useCallback(async () => {
    setReportsLoading(true)
    try {
      const [sumRes, poolRes] = await Promise.all([reportsApi.getSummary(), fundsApi.getInvestmentPoolSummary()])
      setSummary(sumRes.data)
      setPoolSummary(poolRes.data)
    } catch { toast({ title: 'Error', description: 'Failed to load reports', variant: 'destructive' }) }
    finally { setReportsLoading(false) }
  }, [toast])

  useEffect(() => {
    const loaders = {
      overview:    loadOverview,
      sites:       loadSites,
      expenses:    loadExpenses,
      bills:       loadBills,
      investments: loadInvestments,
      funds:       loadFunds,
      attendance:  loadAttendance,
      ledger:      loadLedger,
      users:       loadUsers,
      reports:     loadReports,
    }
    loaders[activeTab]?.()
  }, [activeTab, loadOverview, loadSites, loadExpenses, loadBills, loadInvestments,
      loadFunds, loadAttendance, loadLedger, loadUsers, loadReports])

  // ── Sheet helpers ──

  const closeSheet = () => {
    setSheetOpen(false)
    setFundsForm({ amount: '', toUserId: '', description: '', referenceNumber: '' })
    setAttendanceForm({ workerId: '', date: TODAY, status: 'present', hoursWorked: '8', notes: '' })
    setLedgerForm({ amount: '', workerId: '', paymentMode: 'cash', description: '', transactionDate: TODAY })
    setInvestForm({ amount: '', partnerId: '', description: '', investmentDate: TODAY, paymentMode: 'bank_transfer', referenceNumber: '' })
  }

  // ── Form submissions ──

  const handleFundsSubmit = async (e) => {
    e.preventDefault()
    try {
      await fundsApi.create({ toUserId: fundsForm.toUserId, amount: parseFloat(fundsForm.amount), description: fundsForm.description, referenceNumber: fundsForm.referenceNumber })
      toast({ title: 'Fund allocated' }); closeSheet(); loadFunds()
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' }) }
  }

  const handleAttendanceSubmit = async (e) => {
    e.preventDefault()
    try {
      const hrs = attendanceForm.status === 'present' ? parseFloat(attendanceForm.hoursWorked) : attendanceForm.status === 'half_day' ? 4 : 0
      await attendanceApi.create({ workerId: attendanceForm.workerId, date: attendanceForm.date, status: attendanceForm.status, hoursWorked: hrs, notes: attendanceForm.notes })
      toast({ title: 'Attendance recorded' }); closeSheet(); loadAttendance()
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' }) }
  }

  const handleLedgerSubmit = async (e) => {
    e.preventDefault()
    try {
      await ledgerApi.create({ workerId: ledgerForm.workerId, amount: parseFloat(ledgerForm.amount), type: 'credit', paymentMode: ledgerForm.paymentMode, description: ledgerForm.description, transactionDate: ledgerForm.transactionDate })
      toast({ title: 'Payment recorded' }); closeSheet(); loadLedger()
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' }) }
  }

  const handleInvestSubmit = async (e) => {
    e.preventDefault()
    try {
      await investmentsApi.create({ partnerId: investForm.partnerId, amount: parseFloat(investForm.amount), description: investForm.description, investmentDate: investForm.investmentDate, paymentMode: investForm.paymentMode, referenceNumber: investForm.referenceNumber })
      toast({ title: 'Investment recorded' }); closeSheet(); loadInvestments()
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' }) }
  }

  const fabLabels = { expenses: 'Add Expense', bills: 'Add Bill', investments: 'Add Investment', funds: 'Allocate Fund', attendance: 'Mark Attendance', ledger: 'Pay Worker' }
  const hasFab = activeTab in fabLabels

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <MobileLayout
        title="Construction"
        userName={user?.name}
        onLogout={() => { logout(); navigate('/login') }}
        tabs={TABS}
        wallet={wallet}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        fabLabel={hasFab ? fabLabels[activeTab] : undefined}
        onFabClick={hasFab ? () => setSheetOpen(true) : undefined}
      >

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          summaryLoading ? <TabLoader /> : (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total Expenses" value={formatCurrency(summary?.grandTotal || 0)} color="blue" />
                <StatCard label="Sites" value={`${sites.filter(s => s.status === 'active').length} / ${sites.length}`} sub="active / total" color="green" />
                <StatCard label="Pending Approvals" value={String(summary?.pendingCount ?? '—')} color="amber" />
                <StatCard label="Monthly Avg" value={formatCurrency(
                  summary?.monthlyTrend?.length
                    ? summary.monthlyTrend.reduce((a, b) => a + b.total, 0) / summary.monthlyTrend.length
                    : 0
                )} color="indigo" />
              </div>

              {/* Monthly trend */}
              {summary?.monthlyTrend?.length > 0 && (
                <div className="bg-white rounded-xl overflow-hidden">
                  <p className="px-4 pt-3 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monthly Trend</p>
                  <div className="divide-y divide-gray-100">
                    {summary.monthlyTrend.slice(-6).reverse().map((m, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between">
                        <p className="text-sm text-gray-700">{m.month}</p>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(m.total)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active sites mini-list */}
              {sites.length > 0 && (
                <div className="bg-white rounded-xl overflow-hidden">
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sites</p>
                  <div className="divide-y divide-gray-100">
                    {sites.slice(0, 4).map(site => (
                      <FeedItem key={site._id} seed={site.name} title={site.name} subtitle={site.location || '—'}
                        badge={{ label: site.status?.replace('_', ' ') || 'active', className: SITE_STATUS_BADGE[site.status] || 'bg-gray-100 text-gray-600' }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* ── Sites ── */}
        {activeTab === 'sites' && (
          sitesLoading ? <TabLoader /> :
          sites.length === 0 ? <EmptyFeed icon={Building2} message="No sites yet" /> : (
            <div className="divide-y divide-gray-100 bg-white">
              {sites.map(site => (
                <FeedItem key={site._id} seed={site.name} title={site.name}
                  subtitle={[site.location, site.assignedUsers?.length > 0 && `${site.assignedUsers.length} assigned`].filter(Boolean).join(' · ')}
                  badge={{ label: site.status?.replace('_', ' ') || 'active', className: SITE_STATUS_BADGE[site.status] || 'bg-gray-100 text-gray-600' }} />
              ))}
            </div>
          )
        )}

        {/* ── Expenses ── */}
        {activeTab === 'expenses' && (
          expensesLoading ? <TabLoader /> :
          expenses.length === 0 ? (
            <EmptyFeed icon={Receipt} message="No expenses yet" action={{ label: '+ Add expense', onClick: () => setSheetOpen(true) }} />
          ) : (
            <div className="divide-y divide-gray-100 bg-white">
              {expenses.map(exp => (
                <div key={exp._id}>
                  <FeedItem
                    seed={exp.description || 'E'}
                    title={exp.description || '—'}
                    subtitle={[exp.user?.name, formatDate(exp.expenseDate)].filter(Boolean).join(' · ')}
                    meta={<StatusMeta status={exp.status} />}
                    amount={formatCurrency(exp.requestedAmount || exp.amount)}
                  />
                  <ExpenseActions_ exp={exp} onAction={(e, a) => { setApproveExpense(e); setApproveAction(a) }} />
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Bills ── */}
        {activeTab === 'bills' && (
          billsLoading ? <TabLoader /> :
          bills.length === 0 ? (
            <EmptyFeed icon={FileText} message="No bills yet" action={{ label: '+ Add bill', onClick: () => setSheetOpen(true) }} />
          ) : (
            <div className="divide-y divide-gray-100 bg-white">
              {bills.map(bill => (
                <div key={bill._id}>
                  <FeedItem
                    seed={bill.vendorName || 'B'}
                    title={bill.vendorName || '—'}
                    subtitle={[bill.invoiceNumber, formatDate(bill.billDate)].filter(Boolean).join(' · ')}
                    amount={formatCurrency(bill.totalAmount)}
                    badge={{ label: bill.status, className: BILL_STATUS[bill.status] || 'bg-gray-100 text-gray-600' }}
                  />
                  {bill.status === 'pending' && (
                    <div className="px-4 pb-3 flex gap-2">
                      <button onClick={() => { setApproveBill(bill); setBillAction('approve') }} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">
                        <CheckCircle className="h-3.5 w-3.5" /> Approve
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
          )
        )}

        {/* ── Investments ── */}
        {activeTab === 'investments' && (
          investLoading ? <TabLoader /> : (
            <>
              {/* Summary strip */}
              {investSummary && (
                <div className="p-4 grid grid-cols-2 gap-3">
                  <StatCard label="Total Invested" value={formatCurrency(investSummary.totalInvested || 0)} color="teal" />
                  <StatCard label="Total Withdrawn" value={formatCurrency(investSummary.totalWithdrawn || 0)} color="rose" />
                  <StatCard label="Net Balance" value={formatCurrency((investSummary.totalInvested || 0) - (investSummary.totalWithdrawn || 0))} color="green" />
                  <StatCard label="Partners" value={String(investSummary.partnerCount || partners.length || 0)} color="indigo" />
                </div>
              )}
              {investments.length === 0 ? (
                <EmptyFeed icon={TrendingUp} message="No investments yet" action={{ label: '+ Add investment', onClick: () => setSheetOpen(true) }} />
              ) : (
                <div className="divide-y divide-gray-100 bg-white">
                  {investments.map(inv => {
                    const name = inv.partner?.name || '—'
                    return (
                      <FeedItem
                        key={inv._id}
                        seed={name}
                        title={name}
                        subtitle={[formatDate(inv.investmentDate), inv.paymentMode?.replace('_', ' ')].filter(Boolean).join(' · ')}
                        amount={`${inv.type === 'withdrawal' ? '−' : '+'}${formatCurrency(inv.amount)}`}
                        amountClass={inv.type === 'withdrawal' ? 'text-red-500' : 'text-green-600'}
                      />
                    )
                  })}
                </div>
              )}
            </>
          )
        )}

        {/* ── Funds ── */}
        {activeTab === 'funds' && (
          fundsLoading ? <TabLoader /> :
          funds.length === 0 ? (
            <EmptyFeed icon={Wallet} message="No fund allocations yet" action={{ label: '+ Allocate fund', onClick: () => setSheetOpen(true) }} />
          ) : (
            <div className="divide-y divide-gray-100 bg-white">
              {funds.map(fund => {
                const name = fund.toUser?.name || '—'
                return (
                  <FeedItem
                    key={fund._id}
                    seed={name}
                    title={name}
                    subtitle={[fund.fromUser?.name && `From: ${fund.fromUser.name}`, formatDate(fund.allocationDate || fund.createdAt)].filter(Boolean).join(' · ')}
                    amount={formatCurrency(fund.amount)}
                    badge={{ label: fund.status, className: fund.status === 'disbursed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700' }}
                  />
                )
              })}
            </div>
          )
        )}

        {/* ── Attendance ── */}
        {activeTab === 'attendance' && (
          attendanceLoading ? <TabLoader /> :
          attendance.length === 0 ? (
            <EmptyFeed icon={CalendarDays} message="No attendance records" action={{ label: '+ Mark attendance', onClick: () => setSheetOpen(true) }} />
          ) : (
            <div className="divide-y divide-gray-100 bg-white">
              {attendance.map(rec => {
                const name = rec.worker?.name || '—'
                return (
                  <FeedItem key={rec._id} seed={name} title={name}
                    subtitle={[formatDate(rec.date), rec.hoursWorked > 0 && `${rec.hoursWorked}h`].filter(Boolean).join(' · ')}
                    badge={{ label: rec.status?.replace('_', ' '), className: ATTENDANCE_BADGE[rec.status] || 'bg-gray-100 text-gray-600' }} />
                )
              })}
            </div>
          )
        )}

        {/* ── Ledger ── */}
        {activeTab === 'ledger' && (
          ledgerLoading ? <TabLoader /> :
          ledger.length === 0 ? (
            <EmptyFeed icon={BookOpen} message="No payments recorded" action={{ label: '+ Record payment', onClick: () => setSheetOpen(true) }} />
          ) : (
            <div className="divide-y divide-gray-100 bg-white">
              {ledger.map(entry => {
                const name = entry.worker?.name || '—'
                return (
                  <FeedItem key={entry._id} seed={name} title={name}
                    subtitle={[formatDate(entry.transactionDate), entry.paymentMode?.replace('_', ' ')].filter(Boolean).join(' · ')}
                    amount={`${entry.type === 'credit' ? '+' : '−'}${formatCurrency(entry.amount)}`}
                    amountClass={entry.type === 'credit' ? 'text-green-600' : 'text-red-500'} />
                )
              })}
            </div>
          )
        )}

        {/* ── Users ── */}
        {activeTab === 'users' && (
          usersLoading ? <TabLoader /> :
          users.length === 0 ? <EmptyFeed icon={Users} message="No users found" /> : (
            <div className="divide-y divide-gray-100 bg-white">
              {users.map(u => (
                <FeedItem key={u._id} seed={u.name} title={u.name}
                  subtitle={u.email || u.phone || '—'}
                  badge={{ label: ROLE_LABELS[u.role] || `Role ${u.role}`, className: ROLE_BADGE_CLS[u.role] || 'bg-gray-100 text-gray-600' }} />
              ))}
            </div>
          )
        )}

        {/* ── Reports ── */}
        {activeTab === 'reports' && (
          reportsLoading ? <TabLoader /> : (
            <div className="p-4 space-y-4">
              {/* Expense stats */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Expenses</p>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Grand Total" value={formatCurrency(summary?.grandTotal || 0)} color="blue" />
                  <StatCard label="Pending" value={String(summary?.pendingCount ?? 0)} color="amber" />
                  <StatCard label="Approved" value={formatCurrency(summary?.approvedTotal || 0)} color="green" />
                  <StatCard label="Paid" value={formatCurrency(summary?.paidTotal || 0)} color="teal" />
                </div>
              </div>

              {/* Investment pool */}
              {poolSummary && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Investment Pool</p>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Total Pooled" value={formatCurrency(poolSummary.totalInvested || 0)} color="indigo" />
                    <StatCard label="Allocated Out" value={formatCurrency(poolSummary.totalAllocated || 0)} color="rose" />
                    <StatCard label="Available" value={formatCurrency(poolSummary.availableBalance || 0)} color="green" />
                  </div>
                </div>
              )}

              {/* Monthly trend */}
              {summary?.monthlyTrend?.length > 0 && (
                <div className="bg-white rounded-xl overflow-hidden">
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monthly Expenses</p>
                  <div className="divide-y divide-gray-100">
                    {[...summary.monthlyTrend].reverse().map((m, i) => {
                      const maxTotal = Math.max(...summary.monthlyTrend.map(x => x.total))
                      const pct = maxTotal > 0 ? (m.total / maxTotal) * 100 : 0
                      return (
                        <div key={i} className="px-4 py-3">
                          <div className="flex justify-between mb-1">
                            <p className="text-sm text-gray-700">{m.month}</p>
                            <p className="text-sm font-bold text-gray-900">{formatCurrency(m.total)}</p>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Per-site breakdown */}
              {summary?.siteBreakdown?.length > 0 && (
                <div className="bg-white rounded-xl overflow-hidden">
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">By Site</p>
                  <div className="divide-y divide-gray-100">
                    {summary.siteBreakdown.map((s, i) => (
                      <div key={i} className="px-4 py-3 flex justify-between">
                        <p className="text-sm text-gray-700">{s.site || s.siteName || '—'}</p>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(s.total)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* ── Bottom Sheet ── */}
        <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) closeSheet() }}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-0 pb-safe">
            <div className="px-5 pt-2 pb-6">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
              <h2 className="text-lg font-bold text-gray-900 mb-4">{fabLabels[activeTab]}</h2>

              {activeTab === 'expenses' && (
                <ExpenseForm onSuccess={() => { closeSheet(); toast({ title: 'Expense submitted!' }); loadExpenses() }} onCancel={closeSheet} />
              )}

              {activeTab === 'bills' && (
                <BillForm onSuccess={() => { closeSheet(); toast({ title: 'Bill added!' }); loadBills() }} onCancel={closeSheet} />
              )}

              {activeTab === 'investments' && (
                <form onSubmit={handleInvestSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Amount (₹) *</Label>
                    <Input type="number" placeholder="e.g. 100000" autoFocus value={investForm.amount} onChange={e => setInvestForm(p => ({ ...p, amount: e.target.value }))} min="0" required />
                  </div>
                  {investAmountEntered && (
                    <>
                      {partners.length > 0 && (
                        <div className="space-y-1.5">
                          <Label>Partner *</Label>
                          <Select value={investForm.partnerId} onValueChange={v => setInvestForm(p => ({ ...p, partnerId: v }))} required>
                            <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
                            <SelectContent>
                              {partners.map(pt => <SelectItem key={pt._id} value={pt._id}>{pt.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Payment Mode</Label>
                          <Select value={investForm.paymentMode} onValueChange={v => setInvestForm(p => ({ ...p, paymentMode: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Date</Label>
                          <Input type="date" value={investForm.investmentDate} onChange={e => setInvestForm(p => ({ ...p, investmentDate: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Reference #</Label>
                        <Input placeholder="e.g. TRF-001" value={investForm.referenceNumber} onChange={e => setInvestForm(p => ({ ...p, referenceNumber: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Input placeholder="Optional note" value={investForm.description} onChange={e => setInvestForm(p => ({ ...p, description: e.target.value }))} />
                      </div>
                    </>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!investAmountEntered}>Record</Button>
                    <Button type="button" variant="outline" onClick={closeSheet}>Cancel</Button>
                  </div>
                </form>
              )}

              {activeTab === 'funds' && (
                <form onSubmit={handleFundsSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Amount (₹) *</Label>
                    <Input type="number" placeholder="e.g. 50000" autoFocus value={fundsForm.amount} onChange={e => setFundsForm(p => ({ ...p, amount: e.target.value }))} min="0" required />
                  </div>
                  {fundsAmountEntered && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Allocate To *</Label>
                        <Select value={fundsForm.toUserId} onValueChange={v => setFundsForm(p => ({ ...p, toUserId: v }))} required>
                          <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                          <SelectContent>
                            {allUsers.filter(u => u._id !== user?._id).map(u => <SelectItem key={u._id} value={u._id}>{u.name} ({ROLE_LABELS[u.role]})</SelectItem>)}
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

              {activeTab === 'attendance' && (
                <form onSubmit={handleAttendanceSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Worker *</Label>
                    <Select value={attendanceForm.workerId} onValueChange={v => setAttendanceForm(p => ({ ...p, workerId: v }))} required>
                      <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                      <SelectContent>
                        {allUsers.filter(u => u.role === 4).map(w => <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Status *</Label>
                      <Select value={attendanceForm.status} onValueChange={v => setAttendanceForm(p => ({ ...p, status: v }))}>
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
                      <Input type="date" value={attendanceForm.date} onChange={e => setAttendanceForm(p => ({ ...p, date: e.target.value }))} required />
                    </div>
                  </div>
                  {attendanceForm.status === 'present' && (
                    <div className="space-y-1.5">
                      <Label>Hours Worked</Label>
                      <Input type="number" value={attendanceForm.hoursWorked} onChange={e => setAttendanceForm(p => ({ ...p, hoursWorked: e.target.value }))} min="0" max="24" step="0.5" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Input placeholder="Optional" value={attendanceForm.notes} onChange={e => setAttendanceForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!attendanceForm.workerId}>Save</Button>
                    <Button type="button" variant="outline" onClick={closeSheet}>Cancel</Button>
                  </div>
                </form>
              )}

              {activeTab === 'ledger' && (
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
                            {allUsers.filter(u => u.role === 4).map(w => <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>)}
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
            </div>
          </SheetContent>
        </Sheet>
      </MobileLayout>

      {/* Expense approve/reject/pay dialog */}
      {approveExpense && (
        <ExpenseActions
          expense={approveExpense}
          isOpen={!!approveExpense}
          onClose={() => setApproveExpense(null)}
          onSuccess={() => { setApproveExpense(null); loadExpenses() }}
          action={approveAction}
        />
      )}

      {/* Bill approve/reject/pay dialog */}
      {approveBill && (
        <BillActions
          bill={approveBill}
          isOpen={!!approveBill}
          onClose={() => setApproveBill(null)}
          onSuccess={() => { setApproveBill(null); loadBills() }}
          action={billAction}
        />
      )}
    </>
  )
}
