/**
 * Request Validation Middleware using Joi
 * 
 * Reusable schema validator for request body, params, and query strings.
 * Sanitizes input and returns clean, uniform 400 Bad Request responses.
 */

const { ValidationError } = require('./errorHandler');

/**
 * Validates request data against a Joi schema.
 * 
 * @param {Object} schemas
 * @param {import('joi').ObjectSchema} [schemas.body]
 * @param {import('joi').ObjectSchema} [schemas.params]
 * @param {import('joi').ObjectSchema} [schemas.query]
 */
function validate(schemas = {}) {
  return (req, res, next) => {
    const locations = ['body', 'params', 'query'];
    const errors = [];

    for (const loc of locations) {
      if (schemas[loc]) {
        const { error, value } = schemas[loc].validate(req[loc], {
          abortEarly: false,
          stripUnknown: true,
          allowUnknown: false
        });

        if (error) {
          error.details.forEach(detail => {
            errors.push({
              field: detail.path.join('.'),
              location: loc,
              message: detail.message.replace(/['"]/g, '')
            });
          });
        } else {
          // Replace raw request property with validated/sanitized value
          req[loc] = value;
        }
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError('Request validation failed.', errors));
    }

    next();
  };
}

module.exports = validate;
