const { validationResult } = require('express-validator');
const { validationErrorResponse } = require('../utils/response.utils');

/**
 * Middleware to handle express-validator validation results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors.array());
  }

  next();
};

/**
 * Custom validation helper for complex validations
 */
const validateRequest = (schema) => {
  return async (req, res, next) => {
    try {
      await schema.validateAsync(req.body, { abortEarly: false });
      next();
    } catch (error) {
      const errors = error.details?.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      })) || [{ message: error.message }];

      return validationErrorResponse(res, errors);
    }
  };
};

module.exports = {
  validate,
  validateRequest
};
