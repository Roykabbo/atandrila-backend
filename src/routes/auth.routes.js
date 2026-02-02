const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate, optionalAuth } = require('../middleware/auth.middleware');
const { validationErrorResponse } = require('../utils/response.utils');
const { validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors.array());
  }
  next();
};

// Validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 100 })
    .withMessage('First name too long'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 100 })
    .withMessage('Last name too long'),
  body('phone')
    .optional()
    .matches(/^(?:\+?88)?01[3-9]\d{8}$/)
    .withMessage('Valid Bangladesh phone number required')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const updateProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be 1-100 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be 1-100 characters'),
  body('phone')
    .optional()
    .matches(/^(?:\+?88)?01[3-9]\d{8}$/)
    .withMessage('Valid Bangladesh phone number required')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    })
];

// Public routes
router.post('/register', registerValidation, validate, authController.register);
router.post('/login', loginValidation, validate, authController.login);
router.post('/admin/login', loginValidation, validate, authController.adminLogin);
router.post('/refresh-token', authController.refreshToken);

// Protected routes
router.post('/logout', optionalAuth, authController.logout);
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, updateProfileValidation, validate, authController.updateProfile);
router.post('/change-password', authenticate, changePasswordValidation, validate, authController.changePassword);

module.exports = router;
