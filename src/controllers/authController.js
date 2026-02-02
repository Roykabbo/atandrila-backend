const { User } = require('../models');
const { generateTokenPair, verifyToken } = require('../utils/jwt.utils');
const { successResponse, errorResponse } = require('../utils/response.utils');
const { ROLES } = require('../config/constants');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return errorResponse(res, 'Email already registered', 400);
    }

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      role: ROLES.CUSTOMER
    });

    // Generate tokens
    const tokens = generateTokenPair(user);

    // Save refresh token
    await user.update({ refreshToken: tokens.refreshToken });

    // Set cookie
    res.cookie('token', tokens.accessToken, COOKIE_OPTIONS);

    return successResponse(res, {
      user: user.toJSON(),
      accessToken: tokens.accessToken
    }, 'Registration successful', 201);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    // Check if active
    if (!user.isActive) {
      return errorResponse(res, 'Account is deactivated', 403);
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    // Generate tokens
    const tokens = generateTokenPair(user);

    // Update user
    await user.update({
      refreshToken: tokens.refreshToken,
      lastLogin: new Date()
    });

    // Set cookie
    res.cookie('token', tokens.accessToken, COOKIE_OPTIONS);

    return successResponse(res, {
      user: user.toJSON(),
      accessToken: tokens.accessToken
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find admin user
    const user = await User.findOne({
      where: { email, role: ROLES.ADMIN }
    });
    if (!user) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Check if active
    if (!user.isActive) {
      return errorResponse(res, 'Account is deactivated', 403);
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Generate tokens
    const tokens = generateTokenPair(user);

    // Update user
    await user.update({
      refreshToken: tokens.refreshToken,
      lastLogin: new Date()
    });

    // Set cookie
    res.cookie('token', tokens.accessToken, COOKIE_OPTIONS);

    return successResponse(res, {
      user: user.toJSON(),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await req.user.update({ refreshToken: null });
    }

    res.clearCookie('token');

    return successResponse(res, null, 'Logout successful');
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return errorResponse(res, 'Refresh token required', 400);
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return errorResponse(res, 'Invalid refresh token', 401);
    }

    const user = await User.findByPk(decoded.id);
    if (!user || user.refreshToken !== token) {
      return errorResponse(res, 'Invalid refresh token', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account is deactivated', 403);
    }

    // Generate new tokens
    const tokens = generateTokenPair(user);

    // Update refresh token
    await user.update({ refreshToken: tokens.refreshToken });

    // Set cookie
    res.cookie('token', tokens.accessToken, COOKIE_OPTIONS);

    return successResponse(res, {
      accessToken: tokens.accessToken
    }, 'Token refreshed');
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    return successResponse(res, { user: req.user.toJSON() });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body;

    await req.user.update({
      firstName,
      lastName,
      phone
    });

    return successResponse(res, { user: req.user.toJSON() }, 'Profile updated');
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const isValidPassword = await req.user.validatePassword(currentPassword);
    if (!isValidPassword) {
      return errorResponse(res, 'Current password is incorrect', 400);
    }

    await req.user.update({ password: newPassword });

    return successResponse(res, null, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  adminLogin,
  logout,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword
};
