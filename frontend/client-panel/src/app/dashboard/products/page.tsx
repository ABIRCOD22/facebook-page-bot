"use client"

import { useEffect, useState } from "react"
import { Plus, Search, Pencil, Trash2, Package, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"

type Product = {
  id: string
  name: string
  description: string
  price: string
  currency: string
  availability: string
  category: string
  variants: string
  image_url: string | null
}

const EMPTY = { name: "", description: "", price: "", currency: "BDT", availability: "in_stock", category: "", variants: "" }

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  const fetchProducts = (s = "") => {
    setLoading(true)
    api.listProducts(s)
      .then((r) => setItems(r.products as Product[]))
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchProducts() }, [])

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowForm(true) }
  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({ name: p.name, description: p.description, price: p.price, currency: p.currency, availability: p.availability, category: p.category, variants: p.variants })
    setShowForm(true)
  }

  const save = async () => {
    setSaving(true); setMsg("")
    try {
      if (editing) await api.updateProduct(editing.id, form)
      else await api.createProduct(form)
      setShowForm(false)
      fetchProducts(search)
      setMsg(editing ? "Product updated." : "Product added.")
    } catch (e) { setMsg((e as Error).message) } finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return
    await api.deleteProduct(id)
    fetchProducts(search)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Products</h1>
          <p className="text-muted-foreground mt-1">Items your bot can answer questions about. Changes sync to the bot instantly.</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4" /> Add product</Button>
      </div>

      {msg && <p className="text-sm text-primary">{msg}</p>}

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchProducts(search)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="font-medium">No products yet</p>
              <p className="text-sm">Add your first product so the bot can recommend it.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-4 font-medium">Name</th>
                    <th className="p-4 font-medium">Price</th>
                    <th className="p-4 font-medium">Category</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium">{p.name}</td>
                      <td className="p-4">{p.price ? `${p.currency} ${p.price}` : "—"}</td>
                      <td className="p-4 text-muted-foreground">{p.category || "—"}</td>
                      <td className="p-4">
                        <Badge variant={p.availability === "in_stock" ? "success" : "warning"}>
                          {p.availability === "in_stock" ? "In stock" : p.availability}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Edit"><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => remove(p.id)} aria-label="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{editing ? "Edit product" : "New product"}</h2>
                <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted cursor-pointer" aria-label="Close"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-name">Name</Label>
                <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-desc">Description</Label>
                <textarea id="p-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-y" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p-price">Price</Label>
                  <Input id="p-price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="e.g. 1200" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-currency">Currency</Label>
                  <Input id="p-currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p-cat">Category</Label>
                  <Input id="p-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-avail">Availability</Label>
                  <select id="p-avail" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
                    <option value="in_stock">In stock</option>
                    <option value="out_of_stock">Out of stock</option>
                    <option value="preorder">Preorder</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
