const adminService = require('../services/adminService');
const { sendSuccess } = require('../utils/response');

async function getOverview(req, res, next) {
  try {
    const overview = await adminService.getOverview(req.query);
    return sendSuccess(res, 200, 'Admin overview retrieved successfully.', { overview });
  } catch (error) {
    return next(error);
  }
}

async function getUsers(req, res, next) {
  try {
    const result = await adminService.getUsers(req.query);
    return sendSuccess(res, 200, 'Users retrieved successfully.', result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getOverview, getUsers };
