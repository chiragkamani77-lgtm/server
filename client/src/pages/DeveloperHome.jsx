import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { MobileLayout, FeedItem, EmptyFeed } from '@/components/mobile'
import { SiteDetailView } from '@/components/site/SiteDetailView'
import {
  LayoutDashboard, Building2, TrendingUp, Wallet,
  Users, BarChart2, Loader, Plus, Pencil, Trash2,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  sitesApi, fundsApi, usersApi,
  reportsApi, investmentsApi, organizationsApi,
} from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: LayoutDashboard },
  { id: 'sites',       label: 'Sites',       icon: Building2 },
  { id: 'investments', label: 'Investments', icon: TrendingUp },
  { id: 'funds',       label: 'Funds',       icon: Wallet },
  { id: 'users',       label: 'Users',       icon: Users },
  { id: 'reports',     label: 'Reports',     icon: BarChart2 },
]

// ─── Status maps ──────────────────────────────────────────────────────────────

const SITE_STATUS_BADGE = {
  active:    'bg-green-100 text-green-700',
  completed: 'bg-slate-100 text-slate-600',
  on_hold:   'bg-amber-100 text-amber-700',
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

const TODAY = new Date().toISOString().split('T')[0]

// ─── Shared small components ──────────────────────────────────────────────────

function TabLoader() {
  return <div className="flex justify-center py-16"><Loader className="h-6 w-6 animate-spin text-gray-300" /></div>
}

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    amber:  'bg-amber-50 text-amber-700',
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function DeveloperHome() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState('overview')
  const [partners, setPartners] = useState([])
  const [wallet, setWallet] = useState(null)

  // Global data
  const [summary,        setSummary]        = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [sites,          setSites]          = useState([])
  const [sitesLoading,   setSitesLoading]   = useState(false)
  const [investments,    setInvestments]    = useState([])
  const [investSummary,  setInvestSummary]  = useState(null)
  const [investLoading,  setInvestLoading]  = useState(false)
  const [users,          setUsers]          = useState([])
  const [usersLoading,   setUsersLoading]   = useState(false)
  const [poolSummary,    setPoolSummary]    = useState(null)
  const [reportsLoading, setReportsLoading] = useState(false)

  // Sites
  const [selectedSite, setSelectedSite] = useState(null)
  const [siteFormOpen, setSiteFormOpen] = useState(false)
  const [siteForm,     setSiteForm]     = useState({ name: '', address: '', description: '', status: 'active' })

  // Investments sheet
  const [sheetOpen,   setSheetOpen]   = useState(false)
  const [investForm,  setInvestForm]  = useState({
    amount: '', partnerId: '', description: '', investmentDate: TODAY, paymentMode: 'bank_transfer', referenceNumber: '',
  })
  const investAmountEntered = parseFloat(investForm.amount) > 0

  // Users sheet
  const [userSheetOpen, setUserSheetOpen] = useState(false)
  const [editUser,      setEditUser]      = useState(null)
  const [userForm,      setUserForm]      = useState({ name: '', email: '', phone: '', role: '3', password: '' })

  // Funds tab
  const [funds,            setFunds]            = useState([])
  const [fundsLoading,     setFundsLoading]     = useState(false)
  const [walletLoadOpen,   setWalletLoadOpen]   = useState(false)
  const [walletLoadAmount, setWalletLoadAmount] = useState('')
  const walletLoadValid = parseFloat(walletLoadAmount) > 0

  // ── Bootstrap ──

  useEffect(() => {
    // Header shows developer's personal wallet balance
    fundsApi.getWalletSummary()
      .then(r => setWallet(r.data))
      .catch(() => {})
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

  const loadInvestments = useCallback(async () => {
    setInvestLoading(true)
    try {
      const [invRes, sumRes] = await Promise.all([investmentsApi.getAll({ limit: 30 }), investmentsApi.getSummary()])
      setInvestments(invRes.data?.investments || invRes.data || [])
      setInvestSummary(sumRes.data)
    } catch { toast({ title: 'Error', description: 'Failed to load investments', variant: 'destructive' }) }
    finally { setInvestLoading(false) }
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

  const loadFunds = useCallback(async () => {
    setFundsLoading(true)
    try {
      const [fundsRes, poolRes, walletRes] = await Promise.all([
        fundsApi.getAll({ limit: 50 }),
        fundsApi.getInvestmentPoolSummary(),
        fundsApi.getWalletSummary(),
      ])
      setFunds(fundsRes.data?.allocations || [])
      setPoolSummary(poolRes.data)   // investment pool for Funds tab
      setWallet(walletRes.data)      // personal wallet for header
    } catch { toast({ title: 'Error', description: 'Failed to load funds', variant: 'destructive' }) }
    finally { setFundsLoading(false) }
  }, [toast])

  useEffect(() => {
    const loaders = { overview: loadOverview, sites: loadSites, investments: loadInvestments, funds: loadFunds, users: loadUsers, reports: loadReports }
    loaders[activeTab]?.()
    if (activeTab !== 'sites') setSelectedSite(null)
  }, [activeTab, loadOverview, loadSites, loadInvestments, loadFunds, loadUsers, loadReports])

  // ── Handlers ──

  const handleCreateSite = async (e) => {
    e.preventDefault()
    try {
      await sitesApi.create(siteForm)
      toast({ title: 'Site created' })
      setSiteFormOpen(false)
      setSiteForm({ name: '', address: '', description: '', status: 'active' })
      loadSites()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed to create site', variant: 'destructive' })
    }
  }

  const handleInvestSubmit = async (e) => {
    e.preventDefault()
    try {
      await investmentsApi.create({ partnerId: investForm.partnerId, amount: parseFloat(investForm.amount), description: investForm.description, investmentDate: investForm.investmentDate, paymentMode: investForm.paymentMode, referenceNumber: investForm.referenceNumber })
      toast({ title: 'Investment recorded' })
      setSheetOpen(false)
      setInvestForm({ amount: '', partnerId: '', description: '', investmentDate: TODAY, paymentMode: 'bank_transfer', referenceNumber: '' })
      loadInvestments()
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' }) }
  }

  const openAddUser = () => {
    setEditUser(null)
    setUserForm({ name: '', email: '', phone: '', role: '3', password: '' })
    setUserSheetOpen(true)
  }

  const openEditUser = (u) => {
    setEditUser(u)
    setUserForm({ name: u.name || '', email: u.email || '', phone: u.phone || '', role: String(u.role || 3), password: '' })
    setUserSheetOpen(true)
  }

  const handleUserSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = { name: userForm.name, email: userForm.email, phone: userForm.phone, role: parseInt(userForm.role) }
      if (editUser) {
        await usersApi.update(editUser._id, payload)
        toast({ title: 'User updated' })
      } else {
        await usersApi.create({ ...payload, password: userForm.password })
        toast({ title: 'User created' })
      }
      setUserSheetOpen(false)
      loadUsers()
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' }) }
  }

  const handleUserDelete = async (id) => {
    try {
      await usersApi.delete(id)
      toast({ title: 'User deleted' })
      loadUsers()
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' }) }
  }

  const handleLoadWallet = async (e) => {
    e.preventDefault()
    try {
      await fundsApi.create({ toUserId: user._id, amount: parseFloat(walletLoadAmount) })
      toast({ title: 'Wallet loaded successfully' })
      setWalletLoadOpen(false)
      setWalletLoadAmount('')
      loadFunds()
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' }) }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  // Full-page site detail — renders outside MobileLayout so it takes the whole screen
  if (selectedSite) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
        <SiteDetailView site={selectedSite} onBack={() => setSelectedSite(null)} />
      </div>
    )
  }

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
        fabLabel={activeTab === 'investments' ? 'Add Investment' : activeTab === 'funds' ? 'Load Wallet' : activeTab === 'users' ? 'Add User' : undefined}
        onFabClick={activeTab === 'investments' ? () => setSheetOpen(true) : activeTab === 'funds' ? () => setWalletLoadOpen(true) : activeTab === 'users' ? openAddUser : undefined}
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

              {/* Clickable sites list */}
              {sites.length > 0 && (
                <div className="bg-white rounded-xl overflow-hidden">
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sites</p>
                  <div className="divide-y divide-gray-100">
                    {sites.slice(0, 5).map(site => (
                      <FeedItem key={site._id} seed={site.name} title={site.name}
                        subtitle={site.location || site.address || '—'}
                        badge={{ label: site.status?.replace('_', ' ') || 'active', className: SITE_STATUS_BADGE[site.status] || 'bg-gray-100 text-gray-600' }}
                        onClick={() => setSelectedSite(site)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* ── Sites ── */}
        {activeTab === 'sites' && (
          <div className="relative min-h-full">
            {sitesLoading ? <TabLoader /> :
              sites.length === 0
                ? <EmptyFeed icon={Building2} message="No sites yet" action={{ label: '+ Add Site', onClick: () => setSiteFormOpen(true) }} />
                : <div className="divide-y divide-gray-100 bg-white pb-24">
                    {sites.map(site => (
                      <FeedItem key={site._id} seed={site.name} title={site.name}
                        subtitle={[site.location || site.address, site.assignedUsers?.length > 0 && `${site.assignedUsers.length} members`].filter(Boolean).join(' · ')}
                        badge={{ label: site.status?.replace('_', ' ') || 'active', className: SITE_STATUS_BADGE[site.status] || 'bg-gray-100 text-gray-600' }}
                        onClick={() => setSelectedSite(site)} />
                    ))}
                  </div>
            }
            <button
              onClick={() => setSiteFormOpen(true)}
              className="fixed bottom-24 right-4 z-30 h-14 w-14 flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-lg"
              aria-label="Add Site"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        )}

        {/* ── Investments ── */}
        {activeTab === 'investments' && (
          investLoading ? <TabLoader /> : (
            <>
              {investSummary && (
                <div className="p-4 grid grid-cols-2 gap-3">
                  <StatCard label="Total Invested" value={formatCurrency(investSummary.totalInvested || 0)} color="teal" />
                  <StatCard label="Total Withdrawn" value={formatCurrency(investSummary.totalWithdrawn || 0)} color="rose" />
                  <StatCard label="Net Balance" value={formatCurrency((investSummary.totalInvested || 0) - (investSummary.totalWithdrawn || 0))} color="green" />
                  <StatCard label="Partners" value={String(investSummary.partnerCount || partners.length || 0)} color="indigo" />
                </div>
              )}
              {investments.length === 0
                ? <EmptyFeed icon={TrendingUp} message="No investments yet" action={{ label: '+ Add investment', onClick: () => setSheetOpen(true) }} />
                : <div className="divide-y divide-gray-100 bg-white">
                    {investments.map(inv => {
                      const name = inv.partner?.name || '—'
                      return (
                        <FeedItem key={inv._id} seed={name} title={name}
                          subtitle={[formatDate(inv.investmentDate), inv.paymentMode?.replace('_', ' ')].filter(Boolean).join(' · ')}
                          amount={`${inv.type === 'withdrawal' ? '−' : '+'}${formatCurrency(inv.amount)}`}
                          amountClass={inv.type === 'withdrawal' ? 'text-red-500' : 'text-green-600'} />
                      )
                    })}
                  </div>
              }
            </>
          )
        )}

        {/* ── Funds ── */}
        {activeTab === 'funds' && (
          fundsLoading ? <TabLoader /> : (
            <>
              <div className="p-4 space-y-3">
                <div className="bg-blue-600 rounded-2xl p-5 text-white">
                  <p className="text-xs font-medium opacity-70">Investment Pool Available</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(poolSummary?.availablePool ?? poolSummary?.availableBalance ?? 0)}</p>
                  <div className="flex gap-4 mt-3 text-xs opacity-80">
                    <span>Total: {formatCurrency(poolSummary?.totalInvestment || poolSummary?.totalInvested || 0)}</span>
                    <span>Allocated: {formatCurrency(poolSummary?.totalAllocated || 0)}</span>
                  </div>
                </div>
                <div className="bg-green-600 rounded-2xl p-5 text-white">
                  <p className="text-xs font-medium opacity-70">My Wallet</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(wallet?.remainingBalance || 0)}</p>
                  <div className="flex gap-4 mt-3 text-xs opacity-80">
                    <span>Received: {formatCurrency(wallet?.totalReceived || 0)}</span>
                    <span>Spent: {formatCurrency(wallet?.totalSpent || 0)}</span>
                  </div>
                </div>
              </div>
              {funds.length === 0
                ? <EmptyFeed icon={Wallet} message="No wallet loads yet" action={{ label: '+ Load Wallet', onClick: () => setWalletLoadOpen(true) }} />
                : <div className="divide-y divide-gray-100 bg-white pb-24">
                    {funds.map(fund => {
                      const name = fund.toUser?.name || '—'
                      return (
                        <FeedItem key={fund._id} seed={name} title={name}
                          subtitle={formatDate(fund.allocationDate || fund.createdAt)}
                          amount={formatCurrency(fund.amount)}
                          badge={{ label: fund.status, className: fund.status === 'disbursed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700' }} />
                      )
                    })}
                  </div>
              }
            </>
          )
        )}

        {/* ── Users ── */}
        {activeTab === 'users' && (
          usersLoading ? <TabLoader /> :
          users.length === 0
            ? <EmptyFeed icon={Users} message="No users found" action={{ label: '+ Add User', onClick: openAddUser }} />
            : (
              <div className="divide-y divide-gray-100 bg-white pb-24">
                {users.map(u => (
                  <div key={u._id} className="flex items-center pr-2">
                    <div className="flex-1 min-w-0">
                      <FeedItem seed={u.name} title={u.name}
                        subtitle={u.email || u.phone || '—'}
                        badge={{ label: ROLE_LABELS[u.role] || `Role ${u.role}`, className: ROLE_BADGE_CLS[u.role] || 'bg-gray-100 text-gray-600' }} />
                    </div>
                    <div className="shrink-0 flex gap-0.5">
                      <button onClick={() => openEditUser(u)} className="p-2 text-blue-400 hover:text-blue-600 rounded-full hover:bg-blue-50">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleUserDelete(u._id)} className="p-2 text-red-400 hover:text-red-600 rounded-full hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
        )}

        {/* ── Reports ── */}
        {activeTab === 'reports' && (
          reportsLoading ? <TabLoader /> : (
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Expenses</p>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Grand Total" value={formatCurrency(summary?.grandTotal || 0)} color="blue" />
                  <StatCard label="Pending" value={String(summary?.pendingCount ?? 0)} color="amber" />
                  <StatCard label="Approved" value={formatCurrency(summary?.approvedTotal || 0)} color="green" />
                  <StatCard label="Paid" value={formatCurrency(summary?.paidTotal || 0)} color="teal" />
                </div>
              </div>

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

        {/* ── Create Site Sheet ── */}
        <Sheet open={siteFormOpen} onOpenChange={(open) => { if (!open) { setSiteFormOpen(false); setSiteForm({ name: '', address: '', description: '', status: 'active' }) } }}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-0 pb-safe">
            <div className="px-5 pt-2 pb-6">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
              <h2 className="text-lg font-bold text-gray-900 mb-4">Create New Site</h2>
              <form onSubmit={handleCreateSite} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Site Name *</Label>
                  <Input autoFocus placeholder="e.g. Sunrise Apartments Block A"
                    value={siteForm.name} onChange={e => setSiteForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
                {siteForm.name.trim().length > 0 && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Location / Address</Label>
                      <Input placeholder="e.g. 123 Main Road, Surat"
                        value={siteForm.address} onChange={e => setSiteForm(p => ({ ...p, address: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <Textarea placeholder="e.g. Residential complex – 20 units" rows={2}
                        value={siteForm.description} onChange={e => setSiteForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={siteForm.status} onValueChange={v => setSiteForm(p => ({ ...p, status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">🟢 Active</SelectItem>
                          <SelectItem value="on_hold">🟡 On Hold</SelectItem>
                          <SelectItem value="completed">🔵 Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-700" disabled={!siteForm.name.trim()}>
                    Create Site
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setSiteFormOpen(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          </SheetContent>
        </Sheet>

        {/* ── Investment Sheet ── */}
        <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) setSheetOpen(false) }}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-0 pb-safe">
            <div className="px-5 pt-2 pb-6">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
              <h2 className="text-lg font-bold text-gray-900 mb-4">Add Investment</h2>
              <form onSubmit={handleInvestSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Amount (₹) *</Label>
                  <Input type="number" placeholder="e.g. 100000" autoFocus value={investForm.amount}
                    onChange={e => setInvestForm(p => ({ ...p, amount: e.target.value }))} min="0" required />
                </div>
                {investAmountEntered && (
                  <>
                    {partners.length > 0 && (
                      <div className="space-y-1.5">
                        <Label>Partner *</Label>
                        <Select value={investForm.partnerId} onValueChange={v => setInvestForm(p => ({ ...p, partnerId: v }))}>
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
                        <Input type="date" value={investForm.investmentDate}
                          onChange={e => setInvestForm(p => ({ ...p, investmentDate: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Reference #</Label>
                      <Input placeholder="e.g. TRF-001" value={investForm.referenceNumber}
                        onChange={e => setInvestForm(p => ({ ...p, referenceNumber: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <Input placeholder="Optional note" value={investForm.description}
                        onChange={e => setInvestForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                  </>
                )}
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!investAmountEntered}>Record</Button>
                  <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          </SheetContent>
        </Sheet>

        {/* ── Load Wallet Sheet ── */}
        <Sheet open={walletLoadOpen} onOpenChange={(open) => { if (!open) { setWalletLoadOpen(false); setWalletLoadAmount('') } }}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-0 pb-safe">
            <div className="px-5 pt-2 pb-6">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
              <h2 className="text-lg font-bold text-gray-900 mb-1">Load My Wallet</h2>
              {poolSummary?.availablePool != null && (
                <p className="text-sm text-gray-400 mb-4">Pool Available: <span className="font-semibold text-gray-700">{formatCurrency(poolSummary.availablePool)}</span></p>
              )}
              <form onSubmit={handleLoadWallet} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Amount (₹) *</Label>
                  <Input type="number" placeholder="e.g. 50000" autoFocus value={walletLoadAmount}
                    onChange={e => setWalletLoadAmount(e.target.value)} min="0" required />
                </div>
                {walletLoadValid && poolSummary?.availablePool != null && parseFloat(walletLoadAmount) > poolSummary.availablePool && (
                  <p className="text-xs text-red-500">Amount exceeds available pool balance</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700"
                    disabled={!walletLoadValid || (poolSummary?.availablePool != null && parseFloat(walletLoadAmount) > poolSummary.availablePool)}>
                    Load to My Wallet
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setWalletLoadOpen(false); setWalletLoadAmount('') }}>Cancel</Button>
                </div>
              </form>
            </div>
          </SheetContent>
        </Sheet>

        {/* ── User Sheet ── */}
        <Sheet open={userSheetOpen} onOpenChange={(open) => { if (!open) setUserSheetOpen(false) }}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-0 pb-safe">
            <div className="px-5 pt-2 pb-6">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
              <h2 className="text-lg font-bold text-gray-900 mb-4">{editUser ? 'Edit User' : 'Add User'}</h2>
              <form onSubmit={handleUserSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input autoFocus placeholder="e.g. Ramesh Kumar"
                    value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
                {userForm.name.trim().length > 0 && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input type="email" placeholder="e.g. ramesh@example.com"
                        value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input type="tel" placeholder="e.g. 9876543210"
                        value={userForm.phone} onChange={e => setUserForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role *</Label>
                      <Select value={userForm.role} onValueChange={v => setUserForm(p => ({ ...p, role: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">Engineer</SelectItem>
                          <SelectItem value="3">Supervisor</SelectItem>
                          <SelectItem value="4">Worker</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {!editUser && (
                      <div className="space-y-1.5">
                        <Label>Password *</Label>
                        <Input type="password" placeholder="Set initial password"
                          value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} required />
                      </div>
                    )}
                  </>
                )}
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!userForm.name.trim()}>
                    {editUser ? 'Save Changes' : 'Create User'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setUserSheetOpen(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          </SheetContent>
        </Sheet>

      </MobileLayout>
    </>
  )
}
