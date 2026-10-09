import api from './api';

const analyticsApi = {
  today: () => api.get('/analytics/today'),
  weekly: () => api.get('/analytics/weekly'),
  monthly: () => api.get('/analytics/monthly'),
  ranking: () => api.get('/analytics/ranking'),
  heatmap: () => api.get('/analytics/heatmap'),
};

export default analyticsApi;
