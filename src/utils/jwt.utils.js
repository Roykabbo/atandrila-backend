const jwt = require('jsonwebtoken');
const { JWT } = require('../config/constants');

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_in_production';

const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT.ACCESS_EXPIRY
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT.REFRESH_EXPIRY
  });
};

const generateTokenPair = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload)
  };
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyToken,
  decodeToken
};
