import api from './api';

const goalApi = {
  create: (goal) => api.post('/goals', goal),
  list: () => api.get('/goals'),
  get: (id) => api.get(`/goals/${encodeURIComponent(id)}`),
  progress: (id) => api.get(`/goals/${encodeURIComponent(id)}/progress`),
  update: (id, goal) => api.put(`/goals/${encodeURIComponent(id)}`, goal),
  delete: (id) => api.delete(`/goals/${encodeURIComponent(id)}`),
};

export default goalApi;
