import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { sitesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  PageLayout, PageHeader, SummaryBanner, SearchFilterBar,
  ListItem, ActionBtn, EmptyState,
} from '@/components/page'
import { Plus, Building, Eye, Edit, Trash2, Users } from 'lucide-react'

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-yellow-100 text-yellow-700',
}

export default function Sites() {
  const { isAdmin } = useAuth()
  const { toast } = useToast()

  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingSite, setEditingSite] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    name: '',
    address: '',
    description: '',
    status: 'active',
  })

  useEffect(() => { fetchSites() }, [])

  const fetchSites = async () => {
    try {
      const { data } = await sitesApi.getAll()
      setSites(data)
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch sites', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingSite) {
        await sitesApi.update(editingSite._id, form)
        toast({ title: 'Site updated' })
      } else {
        await sitesApi.create(form)
        toast({ title: 'Site created' })
      }
      setSheetOpen(false)
      resetForm()
      fetchSites()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to save site', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    try {
      await sitesApi.delete(deleteId)
      toast({ title: 'Site deleted' })
      setDeleteId(null)
      fetchSites()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to delete site', variant: 'destructive' })
    }
  }

  const openAdd = () => {
    setEditingSite(null)
    resetForm()
    setSheetOpen(true)
  }

  const openEdit = (site) => {
    setEditingSite(site)
    setForm({
      name: site.name,
      address: site.address || '',
      description: site.description || '',
      status: site.status,
    })
    setSheetOpen(true)
  }

  const resetForm = () => {
    setForm({ name: '', address: '', description: '', status: 'active' })
  }

  const filteredSites = sites.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.name?.toLowerCase().includes(q) || s.address?.toLowerCase().includes(q)
  })

  const activeSites = sites.filter(s => s.status === 'active').length
  const completedSites = sites.filter(s => s.status === 'completed').length

  return (
    <PageLayout>
      <PageHeader title="Sites" subtitle={`${sites.length} total sites`}>
        {isAdmin && (
          <Button size="sm" onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-1" />
            Add Site
          </Button>
        )}
      </PageHeader>

      <SummaryBanner
        color="teal"
        icon={<Building className="h-8 w-8" />}
        items={[
          { label: 'Active Sites', value: String(activeSites) },
          { label: 'Completed', value: String(completedSites) },
        ]}
      />

      <SearchFilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search site name or address..."
      />

      <div className="flex-1">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
          </div>
        ) : filteredSites.length === 0 ? (
          <EmptyState
            message={search ? 'No sites match your search' : 'No sites found'}
            icon={<Building className="h-12 w-12" />}
            action={
              !isAdmin ? (
                <p className="text-xs text-center text-gray-400 max-w-xs">
                  You haven't been assigned to any sites yet. Contact your administrator.
                </p>
              ) : (
                <Button variant="outline" size="sm" onClick={openAdd}>
                  <Plus className="h-4 w-4 mr-1" /> Add First Site
                </Button>
              )
            }
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredSites.map((site) => (
              <ListItem
                key={site._id}
                avatar={site.name}
                avatarColor="teal"
                title={site.name}
                subtitle={
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {site.address && <span className="text-xs text-gray-400">{site.address}</span>}
                    <span className="text-xs text-gray-400">
                      {site.address ? '•' : ''} <Users className="h-3 w-3 inline" /> {site.assignedUsers?.length || 0} members
                    </span>
                  </div>
                }
                badge={{
                  label: site.status.replace('_', ' '),
                  className: STATUS_COLORS[site.status] || '',
                }}
                actions={
                  <>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-gray-400 hover:text-teal-600 hover:bg-teal-50"
                    >
                      <Link to={`/sites/${site._id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    {isAdmin && (
                      <>
                        <ActionBtn onClick={() => openEdit(site)} title="Edit" icon={Edit} hoverClass="hover:text-teal-600 hover:bg-teal-50" />
                        <ActionBtn
                          onClick={() => setDeleteId(site._id)}
                          title="Delete"
                          icon={Trash2}
                          hoverClass="hover:text-red-600 hover:bg-red-50"
                        />
                      </>
                    )}
                  </>
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) resetForm() }}>
        <SheetContent title={editingSite ? 'Edit Site' : 'Add New Site'}>
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <div className="space-y-1">
              <Label>Site Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sunrise Apartments Block A"
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Location / Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="e.g. 123 Main Road, Surat"
              />
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Residential complex - 20 units"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label>Current Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">🟢 Active (Work in progress)</SelectItem>
                  <SelectItem value="completed">🔵 Completed</SelectItem>
                  <SelectItem value="on_hold">🟡 On Hold (Paused)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full h-11 text-base bg-teal-600 hover:bg-teal-700">
              {editingSite ? 'Save Changes' : 'Create Site'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this site?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the site and all its expenses. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
