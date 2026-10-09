import api from './api';

const activityApi = {
  start: (activity) => api.post('/activities/start', activity),
  stop: () => api.post('/activities/stop', {}),
  list: () => api.get('/activities'),
  today: () => api.get('/activities/today'),
};

export default activityApi;
