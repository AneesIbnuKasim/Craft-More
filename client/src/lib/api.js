const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:4000/api').replace(/\/+$/, '');
let csrfToken;

const request = async (path, options = {}) => {
  const { headers: requestHeaders, ...requestOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}) }
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error?.message ?? 'Something went wrong');
    error.status = response.status; error.code = data?.error?.code;
    throw error;
  }
  return data;
};

const withCsrf = async () => {
  if (!csrfToken) csrfToken = (await request('/auth/csrf')).csrfToken;
  return csrfToken;
};

export const api = {
  me: () => request('/auth/me'),
  login: async (body) => { const result = await request('/auth/login', { method: 'POST', body: JSON.stringify(body) }); csrfToken = undefined; return result; },
  logout: async () => { const token = await withCsrf(); const result = await request('/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': token } }); csrfToken = undefined; return result; },
  customers: (query = '') => request(`/customers${query}`),
  customer: (id) => request(`/customers/${id}`),
  customerPurchases: (id, query = '') => request(`/customers/${id}/purchases${query}`),
  createCustomer: async (body) => request('/customers', { method: 'POST', headers: { 'X-CSRF-Token': await withCsrf() }, body: JSON.stringify(body) }),
  bills: (query = '') => request(`/bills${query}`),
  bill: (id) => request(`/bills/${id}`),
  createBill: async (body, idempotencyKey) => request('/bills', { method: 'POST', headers: { 'X-CSRF-Token': await withCsrf(), 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(body) }),
  correctBill: async (id, body) => request(`/bills/${id}`, { method: 'PUT', headers: { 'X-CSRF-Token': await withCsrf() }, body: JSON.stringify(body) }),
  cancelBill: async (id, reason) => request(`/bills/${id}/cancel`, { method: 'POST', headers: { 'X-CSRF-Token': await withCsrf() }, body: JSON.stringify({ reason }) }),
  dashboard: () => request('/dashboard/summary'),
  monthlySales: (period) => request(`/reports/monthly-sales?period=${encodeURIComponent(period)}`),
  customerReport: (period) => request(`/reports/customers?period=${encodeURIComponent(period)}`),
  discountReport: (period) => request(`/reports/discounts?period=${encodeURIComponent(period)}`)
};
