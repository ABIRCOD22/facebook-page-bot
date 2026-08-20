"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Search, Pencil, Trash2, Package, X, Scan, Loader2, ImageIcon, Check } from "lucide-react"
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

const EMPTY = { name: "", description: "", price: "", currency: "BDT", availability: "in_stock", category: "", variants: "", image_url: "" }

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  // Scan state
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ imported: number; skipped: number; total_found: number } | null>(null)

  // Inline price edit state
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState("")

  const fetchProducts = useCallback((s = "") => {
    setLoading(true)
    api.listProducts(s)
      .then((r) => setItems(r.products as Product[]))
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowForm(true) }
  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({ name: p.name, description: p.description, price: p.price, currency: p.currency, availability: p.availability, category: p.category, variants: p.variants, image_url: p.image_url || "" })
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

  const scanFacebook = async () => {
    setScanning(true); setScanResult(null); setMsg("")
    try {
      const result = await api.scanProducts()
      setScanResult(result)
      setMsg(`Scan complete: ${result.imported} imported, ${result.skipped} already existed`)
      fetchProducts(search)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setScanning(false)
    }
  }

  const startEditPrice = (p: Product) => {
    setEditingPriceId(p.id)
    setEditingPriceValue(p.price || "")
  }

  const saveInlinePrice = async (id: string) => {
    try {
      await api.updateProduct(id, { price: editingPriceValue })
      setEditingPriceId(null)
      fetchProducts(search)
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Products</h1>
          <p className="text-muted-foreground mt-1">Items your bot can answer questions about. Scan from Facebook or add manually.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={scanFacebook} disabled={scanning}>
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
            {scanning ? "Scanning…" : "Scan from Facebook"}
          </Button>
          <Button onClick={openAdd}><Plus className="w-4 h-4" /> Add product</Button>
        </div>
      </div>

      {/* Scan result banner */}
      {scanResult && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Check className="w-5 h-5 text-green-600" />
            <div className="text-sm">
              <span className="font-medium text-green-800">Scan complete!</span>{" "}
              <span className="text-green-700">
                Found {scanResult.total_found} products — {scanResult.imported} new imported, {scanResult.skipped} already existed.
              </span>
            </div>
            <button onClick={() => setScanResult(null)} className="ml-auto text-green-600 hover:text-green-800 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Status message */}
      {msg && !scanResult && <p className="text-sm text-primary">{msg}</p>}

      {/* Search */}
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

      {/* Product grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading products…
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-medium text-lg">No products yet</p>
            <p className="text-sm mt-1 mb-4">Scan your Facebook Page to auto-import products, or add them manually.</p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={scanFacebook} disabled={scanning}>
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                Scan from Facebook
              </Button>
              <Button onClick={openAdd}><Plus className="w-4 h-4" /> Add manually</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((p) => (
            <Card key={p.id} className="group overflow-hidden hover:shadow-md transition-shadow">
              {/* Product image */}
              <div className="relative aspect-square bg-muted">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}
                {/* Availability badge overlay */}
                <div className="absolute top-2 left-2">
                  <Badge variant={p.availability === "in_stock" ? "success" : "warning"} className="text-xs">
                    {p.availability === "in_stock" ? "In Stock" : p.availability === "out_of_stock" ? "Out of Stock" : p.availability}
                  </Badge>
                </div>
                {/* Actions overlay */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="secondary" size="icon" className="h-7 w-7 bg-white/90 hover:bg-white" onClick={() => openEdit(p)} aria-label="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="secondary" size="icon" className="h-7 w-7 bg-white/90 hover:bg-white" onClick={() => remove(p.id)} aria-label="Delete">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>

              {/* Product info */}
              <CardContent className="p-4 space-y-2">
                <h3 className="font-medium text-sm leading-tight line-clamp-2">{p.name}</h3>
                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                )}

                {/* Inline price editing */}
                <div className="flex items-center justify-between pt-1">
                  {editingPriceId === p.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={editingPriceValue}
                        onChange={(e) => setEditingPriceValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveInlinePrice(p.id); if (e.key === "Escape") setEditingPriceId(null) }}
                        className="w-24 h-7 text-sm font-bold rounded border px-2"
                        placeholder="Price"
                        autoFocus
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveInlinePrice(p.id)}>
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      className="text-lg font-bold text-primary hover:underline cursor-pointer"
                      onClick={() => startEditPrice(p)}
                      title="Click to edit price"
                    >
                      {p.price ? `${p.currency} ${p.price}` : <span className="text-muted-foreground text-sm font-normal">Tap to set price</span>}
                    </button>
                  )}
                </div>

                {p.category && (
                  <Badge variant="outline" className="text-xs">{p.category}</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Product count */}
      {items.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {items.length} product{items.length !== 1 ? "s" : ""} total
        </p>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
              <div className="space-y-2">
                <Label htmlFor="p-img">Image URL</Label>
                <Input id="p-img" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
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
                    <option value="pre_order">Pre-order</option>
                    <option value="limited">Limited</option>
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
