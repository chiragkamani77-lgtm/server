import { useState, useEffect } from 'react'
import { sitesApi, categoriesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Filter, X } from 'lucide-react'

/**
 * ExpenseFilters Component
 * Reusable filters for expenses
 * Props:
 * - filters: Current filter values
 * - onChange: Callback when filters change
 * - onClear: Callback to clear all filters
 * - hideSiteFilter: (optional) Hide site filter (for site-specific views)
 */
export function ExpenseFilters({ filters, onChange, onClear, hideSiteFilter = false }) {
  const [sites, setSites] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

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
      console.error('Failed to load filter data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    onChange?.({ ...filters, [field]: value })
  }

  const hasActiveFilters = Object.values(filters).some((value) => value)

  return (
    <div className="space-y-4">
      {/* Filter Toggle Button */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
          {hasActiveFilters && !showFilters && (
            <span className="ml-1 rounded-full bg-blue-600 text-white px-2 py-0.5 text-xs">
              Active
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClear} className="gap-2">
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Filter Form */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Site Filter */}
              {!hideSiteFilter && (
                <div className="space-y-2">
                  <Label htmlFor="siteFilter">Site</Label>
                  <Select
                    value={filters.siteId || ''}
                    onValueChange={(value) => handleChange('siteId', value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="siteFilter">
                      <SelectValue placeholder="All Sites" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Sites</SelectItem>
                      {sites.map((site) => (
                        <SelectItem key={site._id} value={site._id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Category Filter */}
              <div className="space-y-2">
                <Label htmlFor="categoryFilter">Category</Label>
                <Select
                  value={filters.category || ''}
                  onValueChange={(value) => handleChange('category', value)}
                  disabled={loading}
                >
                  <SelectTrigger id="categoryFilter">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category._id} value={category._id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date Filter */}
              <div className="space-y-2">
                <Label htmlFor="startDate">From Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                />
              </div>

              {/* End Date Filter */}
              <div className="space-y-2">
                <Label htmlFor="endDate">To Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => handleChange('endDate', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
