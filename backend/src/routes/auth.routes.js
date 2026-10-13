/**
 * Authentication Routes (/api/v1/auth)
 */

const express = require('express');
const Joi = require('joi');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');

const router = express.Router();

const loginSchema = {
  body: Joi.object({
    email: Joi.string().email({ tlds: { allow: false } }).required(),
    password: Joi.string().required(),
    sellerId: Joi.string().guid().optional(),
    deviceId: Joi.string().max(255).optional()
  })
};

const refreshSchema = {
  body: Joi.object({
    refreshToken: Joi.string().required(),
    deviceId: Joi.string().max(255).optional()
  })
};

const logoutSchema = {
  body: Joi.object({
    refreshToken: Joi.string().optional(),
    deviceId: Joi.string().max(255).optional()
  })
};

// Public Routes
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);

// Protected Routes
router.post('/logout', authenticate, validate(logoutSchema), authController.logout);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
