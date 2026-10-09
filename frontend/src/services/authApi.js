import api from './api';

const authApi = {
  register: (credentials) => api.post('/auth/register', credentials),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export default authApi;
