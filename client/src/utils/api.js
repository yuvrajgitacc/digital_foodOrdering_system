const API_BASE = '/api';

async function request(url, options = {}) {
    const token = localStorage.getItem('dineflow_token');
    const headers = { ...options.headers };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}${url}`, { ...options, headers });

    let data;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        data = await res.json();
    } else {
        const text = await res.text();
        data = { error: res.statusText || 'Server returned an invalid response' };
    }

    if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
    }
    return data;
}

export const api = {
    // Auth
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    getMe: () => request('/auth/me'),

    // Categories
    getCategories: () => request('/categories'),
    createCategory: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),

    // Menu
    getMenu: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/menu${query ? `?${query}` : ''}`);
    },
    getMenuItem: (id) => request(`/menu/${id}`),
    createMenuItem: (formData) => request('/menu', { method: 'POST', body: formData, headers: {} }),
    updateMenuItem: (id, formData) => request(`/menu/${id}`, { method: 'PUT', body: formData, headers: {} }),
    deleteMenuItem: (id) => request(`/menu/${id}`, { method: 'DELETE' }),
    toggleAvailability: (id, available) => request(`/menu/${id}/availability`, { method: 'PUT', body: JSON.stringify({ is_available: available }) }),

    // Tables
    getTables: () => request('/tables'),
    getTable: (id) => request(`/tables/${id}`),
    createTable: (data) => request('/tables', { method: 'POST', body: JSON.stringify(data) }),
    updateTable: (id, data) => request(`/tables/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTable: (id) => request(`/tables/${id}`, { method: 'DELETE' }),
    checkinTable: (id) => request(`/tables/${id}/checkin`, { method: 'POST' }),
    updateTableStatus: (id, status) => request(`/tables/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    clearTable: (id) => request(`/tables/${id}/clear`, { method: 'POST' }),
    getTableQR: (id) => request(`/tables/${id}/qr`),

    // Orders
    placeOrder: (orderData) => request('/orders', { method: 'POST', body: JSON.stringify(orderData) }),
    getOrders: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/orders${query ? `?${query}` : ''}`);
    },
    getTableOrders: (tableId) => request(`/orders/table/${tableId}`),
    getOrder: (orderId) => request(`/orders/${orderId}`),
    updateOrderStatus: (orderId, status) => request(`/orders/${orderId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

    // Bills
    generateBill: (tableId, data = {}) => request(`/bills/generate/${tableId}`, { method: 'POST', body: JSON.stringify(data) }),
    getTableBills: (tableId) => request(`/bills/table/${tableId}`),
    markBillPaid: (billId, method) => request(`/bills/${billId}/pay`, { method: 'PUT', body: JSON.stringify({ payment_method: method }) }),

    // Stats
    getStats: () => request('/stats'),

    // Notifications
    getNotifications: () => request('/notifications'),
    markNotificationsRead: () => request('/notifications/read', { method: 'PUT' }),
    getUnreadCount: () => request('/notifications/unread-count'),

    // Call Waiter
    callWaiter: (tableId) => request('/waiter-calls', { method: 'POST', body: JSON.stringify({ table_id: tableId }) }),
    getActiveWaiterCalls: () => request('/waiter-calls/active'),
    resolveWaiterCall: (id) => request(`/waiter-calls/${id}/resolve`, { method: 'PUT' }),
};
