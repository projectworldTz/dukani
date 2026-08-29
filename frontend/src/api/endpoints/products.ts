import { api } from '../client'
import type { Product } from '../../types'

interface Paginated<T> {
  data: T[]
  meta?: { current_page: number; last_page: number; total: number }
}

export const productsApi = {
  list: (params?: { search?: string; category_id?: number; status?: string; page?: number }) =>
    api.get<Paginated<Product>>('/products', { params }).then((r) => r.data),
  create: (data: FormData) =>
    api.post<Product>('/products', data, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  update: (id: number, data: FormData) => {
    // Laravel's PUT+multipart method-spoofing needs `_method` in the body itself
    // (query string isn't checked) — see MethodField/@method('PUT') in Laravel docs.
    data.append('_method', 'PUT')
    return api
      .post<Product>(`/products/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data)
  },
  remove: (id: number) => api.delete(`/products/${id}`),
  generateBarcode: (id: number) => api.post(`/products/${id}/barcodes/generate`, { primary: true }).then((r) => r.data),
  assignBarcode: (id: number, code: string, type: string) =>
    api.post(`/products/${id}/barcodes/assign`, { code, type, primary: true }).then((r) => r.data),
  scan: (code: string) => api.post<Product>('/pos/scan', { code }).then((r) => r.data),
  exportCsvBlobUrl: () => api.get('/products/export', { responseType: 'blob' }).then((r) => URL.createObjectURL(r.data as Blob)),
  importCsv: (file: File) => {
    const data = new FormData()
    data.append('file', file)
    return api
      .post<{ created: number; errors: string[] }>('/products/import', data, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data)
  },
  labelsPdfBlobUrl: (productIds: number[], copies: number, size: string, includeQr: boolean) =>
    api
      .post('/products/labels', { product_ids: productIds, copies, size, include_qr: includeQr }, { responseType: 'blob' })
      .then((r) => URL.createObjectURL(r.data as Blob)),
}

export const categoriesApi = {
  list: () => api.get<{ id: number; name: string; parent_id: number | null }[]>('/product-categories').then((r) => r.data),
  create: (name: string, parentId?: number) =>
    api.post('/product-categories', { name, parent_id: parentId }).then((r) => r.data),
}

export const brandsApi = {
  list: () => api.get<{ id: number; name: string }[]>('/brands').then((r) => r.data),
  create: (name: string) => api.post('/brands', { name }).then((r) => r.data),
}

export const unitsApi = {
  list: () => api.get<{ id: number; name: string; short_name: string }[]>('/units').then((r) => r.data),
  create: (name: string, shortName: string) => api.post('/units', { name, short_name: shortName }).then((r) => r.data),
}
