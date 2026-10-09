import api from './api';

const userApi = {
  updatePreferences: (preferences) => api.patch('/users/me/preferences', preferences),
};

export default userApi;
