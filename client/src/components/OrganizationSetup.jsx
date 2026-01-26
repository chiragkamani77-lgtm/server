import { useState } from 'react'
import { organizationsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Building2 } from 'lucide-react'

export function OrganizationSetup({ onComplete }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    gstNumber: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      await organizationsApi.create(form)
      toast({ title: 'Organization created successfully!' })
      if (onComplete) onComplete()
      window.location.reload() // Refresh to update user context
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create organization',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Create Your Organization</CardTitle>
          <CardDescription>
            Set up your organization to start managing sites, partners, and expenses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ABC Constructions Pvt Ltd"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of your organization"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="info@company.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gstNumber">GST Number</Label>
              <Input
                id="gstNumber"
                value={form.gstNumber}
                onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
                placeholder="29ABCDE1234F1Z5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Office address"
                rows={2}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create Organization'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
