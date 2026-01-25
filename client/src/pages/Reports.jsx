import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { sitesApi, reportsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, STATUS_COLORS } from '@/lib/utils'
import { Download, FileSpreadsheet, FileText, Building } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export default function Reports() {
  const { isAdmin } = useAuth()
  const { toast } = useToast()

  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState('')
  const [report, setReport] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  })

  useEffect(() => {
    fetchSites()
    if (isAdmin) {
      fetchSummary()
    }
  }, [])

  useEffect(() => {
    if (selectedSite) {
      fetchReport()
    }
  }, [selectedSite, dateRange])

  const fetchSites = async () => {
    try {
      const { data } = await sitesApi.getAll()
      setSites(data)
    } catch (error) {
      console.error('Error fetching sites:', error)
    }
  }

  const fetchSummary = async () => {
    try {
      const { data } = await reportsApi.getSummary()
      setSummary(data)
    } catch (error) {
      console.error('Error fetching summary:', error)
    }
  }

  const fetchReport = async () => {
    if (!selectedSite) return
    setLoading(true)
    try {
      const params = {}
      if (dateRange.startDate) params.startDate = dateRange.startDate
      if (dateRange.endDate) params.endDate = dateRange.endDate

      const { data } = await reportsApi.getSiteReport(selectedSite, params)
      setReport(data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate report',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const downloadPdf = async () => {
    try {
      const params = {}
      if (dateRange.startDate) params.startDate = dateRange.startDate
      if (dateRange.endDate) params.endDate = dateRange.endDate

      const response = await reportsApi.downloadPdf(selectedSite, params)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${report.site.name}-report.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast({ title: 'PDF downloaded successfully' })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download PDF',
        variant: 'destructive',
      })
    }
  }

  const downloadExcel = async () => {
    try {
      const params = {}
      if (dateRange.startDate) params.startDate = dateRange.startDate
      if (dateRange.endDate) params.endDate = dateRange.endDate

      const response = await reportsApi.downloadExcel(selectedSite, params)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${report.site.name}-report.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast({ title: 'Excel downloaded successfully' })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download Excel',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Generate and download expense reports
        </p>
      </div>

      {/* Overall Summary (Admin Only) */}
      {isAdmin && summary && (
        <Card>
          <CardHeader>
            <CardTitle>Overall Summary</CardTitle>
            <CardDescription>Total expenses across all sites</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Site-wise Totals */}
              <div>
                <h3 className="font-semibold mb-4">Site-wise Expenses</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.siteTotals?.map(s => ({
                      name: s.site?.name?.substring(0, 15) || 'Unknown',
                      total: s.total
                    })) || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="total" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Trend */}
              <div>
                <h3 className="font-semibold mb-4">Monthly Trend</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={summary.monthlyTrend?.map(m => ({
                      name: `${m._id.month}/${m._id.year}`,
                      total: m.total
                    })).reverse() || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Line type="monotone" dataKey="total" stroke="#8884d8" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Grand Total</p>
                <p className="text-3xl font-bold">{formatCurrency(summary.grandTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Site Report Generator */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Site Report</CardTitle>
          <CardDescription>Select a site and date range to generate a detailed report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Select Site</Label>
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site._id} value={site._id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From Date</Label>
              <Input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={downloadPdf}
                  disabled={!selectedSite || !report}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadExcel}
                  disabled={!selectedSite || !report}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Display */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : report && (
        <>
          {/* Report Summary */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{report.site.name}</CardTitle>
                <CardDescription>{report.site.address}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Expenses</span>
                    <span className="font-bold">{formatCurrency(report.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Entries</span>
                    <span className="font-bold">{report.totalEntries}</span>
                  </div>
                  {report.dateRange.startDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Period</span>
                      <span>{report.dateRange.startDate} to {report.dateRange.endDate || 'Present'}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={report.categoryTotals?.map(c => ({
                          name: c.category,
                          value: c.total
                        })) || []}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name }) => name}
                      >
                        {report.categoryTotals?.map((entry, index) => (
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

          {/* Category Details */}
          <Card>
            <CardHeader>
              <CardTitle>Category Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.categoryTotals?.map((cat, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          {cat.category}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(cat.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        {((cat.total / report.totalAmount) * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.totalAmount)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recent Expenses */}
          <Card>
            <CardHeader>
              <CardTitle>Expense Details</CardTitle>
              <CardDescription>All expenses for this report</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Added By</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.expenses?.slice(0, 50).map((expense) => (
                    <TableRow key={expense._id}>
                      <TableCell>{formatDate(expense.expenseDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.category?.name}</Badge>
                      </TableCell>
                      <TableCell>{expense.description || '-'}</TableCell>
                      <TableCell>{expense.vendorName || '-'}</TableCell>
                      <TableCell>{expense.user?.name}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {report.expenses?.length > 50 && (
                <p className="text-center text-muted-foreground mt-4">
                  Showing first 50 entries. Download full report for all {report.expenses.length} entries.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
