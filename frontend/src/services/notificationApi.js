import api from './api';

const notificationApi = {
  list: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${encodeURIComponent(id)}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  dismiss: (id) => api.delete(`/notifications/${encodeURIComponent(id)}`),
};

export default notificationApi;
