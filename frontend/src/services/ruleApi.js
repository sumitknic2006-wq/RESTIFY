import api from './api';

const ruleApi = {
  create: (rule) => api.post('/rules', rule),
  list: () => api.get('/rules'),
  get: (id) => api.get(`/rules/${encodeURIComponent(id)}`),
  update: (id, rule) => api.put(`/rules/${encodeURIComponent(id)}`, rule),
  delete: (id) => api.delete(`/rules/${encodeURIComponent(id)}`),
  toggle: (id) => api.patch(`/rules/${encodeURIComponent(id)}/toggle`),
};

export default ruleApi;
