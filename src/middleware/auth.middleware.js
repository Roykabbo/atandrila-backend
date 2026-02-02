const { verifyToken } = require('../utils/jwt.utils');
const { errorResponse } = require('../utils/response.utils');
const { User } = require('../models');
const { ROLES } = require('../config/constants');

const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // Check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Fall back to cookie
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return errorResponse(res, 'Access token required', 401);
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return errorResponse(res, 'Invalid or expired token', 401);
    }

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return errorResponse(res, 'User not found', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account is deactivated', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return errorResponse(res, 'Authentication failed', 401);
  }
};

const authenticateAdmin = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return errorResponse(res, 'Access token required', 401);
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return errorResponse(res, 'Invalid or expired token', 401);
    }

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return errorResponse(res, 'User not found', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account is deactivated', 403);
    }

    if (user.role !== ROLES.ADMIN) {
      return errorResponse(res, 'Admin access required', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    return errorResponse(res, 'Authentication failed', 401);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        const user = await User.findByPk(decoded.id);
        if (user && user.isActive) {
          req.user = user;
        }
      }
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  authenticate,
  authenticateAdmin,
  optionalAuth
};
