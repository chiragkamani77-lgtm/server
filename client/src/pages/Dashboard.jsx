import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { sitesApi, reportsApi } from '@/lib/api'
import { formatCurrency, STATUS_COLORS } from '@/lib/utils'
import { Building, IndianRupee } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { OrganizationSetup } from '@/components/OrganizationSetup'
import {
  PageLayout, PageHeader, SummaryBanner, ListItem, EmptyState,
} from '@/components/page'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']
const SITE_AVATAR_COLORS = { active: 'teal', completed: 'slate', on_hold: 'amber' }

export default function Dashboard() {
  const { user, isAdmin, hasOrganization } = useAuth()
  const [sites, setSites] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [sitesRes] = await Promise.all([sitesApi.getAll()])
      setSites(sitesRes.data)
      if (isAdmin) {
        const summaryRes = await reportsApi.getSummary()
        setSummary(summaryRes.data)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (isAdmin && !hasOrganization) {
    return <OrganizationSetup />
  }

  const totalSites = sites.length
  const activeSites = sites.filter(s => s.status === 'active').length
  const grandTotal = summary?.grandTotal || 0
  const monthlyAvg = summary?.monthlyTrend?.length > 0
    ? summary.monthlyTrend.reduce((a, b) => a + b.total, 0) / summary.monthlyTrend.length
    : 0

  const summaryItems = isAdmin && summary
    ? [
        { label: 'Total Expenses', value: formatCurrency(grandTotal) },
        { label: 'Sites', value: `${activeSites} / ${totalSites}` },
        { label: 'Monthly Avg', value: formatCurrency(monthlyAvg) },
      ]
    : [
        { label: 'Total Sites', value: String(totalSites) },
        { label: 'Active', value: String(activeSites) },
      ]

  return (
    <PageLayout>
      <PageHeader title="Dashboard" subtitle={`Welcome back, ${user?.name}`} />

      <SummaryBanner
        color="slate"
        icon={isAdmin ? <IndianRupee className="h-8 w-8" /> : <Building className="h-8 w-8" />}
        items={summaryItems}
      />

      {/* Charts — Admin Only */}
      {isAdmin && summary && (
        <div className="px-4 py-4 grid gap-4 md:grid-cols-2">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm font-semibold text-gray-800 mb-1">Site-wise Expenses</p>
            <p className="text-xs text-gray-400 mb-3">Total expenses by site</p>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.siteTotals?.map(s => ({
                  name: s.site?.name || 'Unknown',
                  total: s.total,
                })) || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="total" fill="#475569" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm font-semibold text-gray-800 mb-1">Category Breakdown</p>
            <p className="text-xs text-gray-400 mb-3">Expenses by category</p>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.categoryTotals?.map(c => ({
                      name: c.category || 'Unknown',
                      value: c.total,
                    })) || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={75}
                    dataKey="value"
                  >
                    {summary.categoryTotals?.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Sites List */}
      <div className="px-4 py-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Sites</p>
      </div>
      <div className="flex-1">
        {sites.length === 0 ? (
          <EmptyState
            message="No sites assigned yet"
            icon={<Building className="h-12 w-12" />}
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {sites.map((site) => (
              <ListItem
                key={site._id}
                avatar={site.name}
                avatarColor={SITE_AVATAR_COLORS[site.status] || 'slate'}
                title={site.name}
                subtitle={<span className="text-xs text-gray-400">{site.address || 'No address'}</span>}
                badge={{
                  label: site.status === 'on_hold' ? 'On Hold' : site.status.charAt(0).toUpperCase() + site.status.slice(1),
                  className: STATUS_COLORS[site.status] || '',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  )
}
