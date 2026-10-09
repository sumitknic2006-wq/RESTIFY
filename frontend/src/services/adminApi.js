import api from './api';

const adminApi = {
  overview: (days = 30) => api.get(`/admin/overview?days=${encodeURIComponent(days)}`),
  users: ({ page = 1, limit = 25, search = '', role = 'all' } = {}) => {
    const params = new URLSearchParams({ page, limit, search, role });
    return api.get(`/admin/users?${params}`);
  },
};

export default adminApi;
