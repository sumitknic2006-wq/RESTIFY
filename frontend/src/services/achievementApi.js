import api from './api';

const achievementApi = {
  list: () => api.get('/achievements'),
};

export default achievementApi;
