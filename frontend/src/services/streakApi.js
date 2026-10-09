import api from './api';

const streakApi = {
  get: () => api.get('/streaks'),
};

export default streakApi;
