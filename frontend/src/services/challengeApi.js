import api from './api';

const challengeApi = {
  today: () => api.get('/challenges/today'),
  completeToday: () => api.post('/challenges/today/complete', {}),
};

export default challengeApi;
