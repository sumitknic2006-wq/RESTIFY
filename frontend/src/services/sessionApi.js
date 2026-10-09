import api from './api';

const sessionApi = {
  start: (ruleId) => api.post('/sessions/start', ruleId ? { ruleId } : {}),
  active: () => api.get('/sessions/active'),
  list: () => api.get('/sessions'),
  pause: (id, options) => api.patch(`/sessions/${encodeURIComponent(id)}/pause`, options),
  resume: (id) => api.patch(`/sessions/${encodeURIComponent(id)}/resume`),
  end: (id) => api.patch(`/sessions/${encodeURIComponent(id)}/end`),
};

export default sessionApi;
