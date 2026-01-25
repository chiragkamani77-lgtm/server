import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { sitesApi, expensesApi, reportsApi } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, STATUS_COLORS } from '@/lib/utils'
import { Building, IndianRupee, Receipt, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [sitesRes] = await Promise.all([
        sitesApi.getAll(),
      ])
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  const totalSites = sites.length
  const activeSites = sites.filter(s => s.status === 'active').length
  const grandTotal = summary?.grandTotal || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sites</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSites}</div>
            <p className="text-xs text-muted-foreground">
              {activeSites} active
            </p>
          </CardContent>
        </Card>

        {isAdmin && summary && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(grandTotal)}</div>
                <p className="text-xs text-muted-foreground">
                  Across all sites
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Categories</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.categoryTotals?.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Expense categories
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Avg</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.monthlyTrend?.length > 0
                    ? summary.monthlyTrend.reduce((a, b) => a + b.total, 0) / summary.monthlyTrend.length
                    : 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Per month
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts - Admin Only */}
      {isAdmin && summary && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Site-wise Expenses */}
          <Card>
            <CardHeader>
              <CardTitle>Site-wise Expenses</CardTitle>
              <CardDescription>Total expenses by site</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.siteTotals?.map(s => ({
                    name: s.site?.name || 'Unknown',
                    total: s.total
                  })) || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="total" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Category-wise Expenses */}
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
              <CardDescription>Expenses by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.categoryTotals?.map(c => ({
                        name: c.category || 'Unknown',
                        value: c.total
                      })) || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {summary.categoryTotals?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sites List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Sites</CardTitle>
          <CardDescription>Sites you have access to</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sites.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No sites assigned yet
              </p>
            ) : (
              sites.map((site) => (
                <div
                  key={site._id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <h3 className="font-medium">{site.name}</h3>
                    <p className="text-sm text-muted-foreground">{site.address}</p>
                  </div>
                  <Badge className={STATUS_COLORS[site.status]}>
                    {site.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
