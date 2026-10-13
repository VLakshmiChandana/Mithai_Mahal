/**
 * Authentication Controller
 * 
 * Endpoints:
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/refresh
 * - POST /api/v1/auth/logout
 * - GET  /api/v1/auth/me
 */

const authService = require('../services/auth.service');

async function login(req, res, next) {
  try {
    const { email, password, sellerId } = req.body;
    const metadata = {
      deviceId: req.body.deviceId || req.headers['x-device-id'] || null,
      ipAddress: req.ip || req.connection.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null
    };

    const result = await authService.login({
      email,
      password,
      sellerId: sellerId || null,
      metadata
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenType: 'Bearer',
        user: result.user
      }
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const metadata = {
      deviceId: req.body.deviceId || req.headers['x-device-id'] || null,
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'] || null
    };

    const tokens = await authService.rotateRefreshToken(refreshToken, metadata);

    res.status(200).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer'
      }
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const rawRefreshToken = req.body.refreshToken || null;
    const authHeader = req.headers.authorization;
    let accessToken = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.split(' ')[1];
    }

    const metadata = {
      deviceId: req.body.deviceId || null,
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'] || null
    };

    await authService.logout({
      rawRefreshToken,
      accessToken,
      metadata
    });

    res.status(200).json({
      success: true,
      message: 'Successfully logged out.'
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    // req.user was populated and verified by the authenticate middleware
    const userData = {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name || req.user.businessName || null,
      businessName: req.user.businessName || null,
      ownerName: req.user.ownerName || null,
      logo: req.user.logo || null,
      userType: req.user.userType,
      role: req.user.role,
      permissions: req.user.permissions,
      sellerId: req.user.sellerId,
      verificationStatus: req.user.verificationStatus || null,
      accountStatus: req.user.accountStatus || null,
      rejectionReason: req.user.rejectionReason || null
    };

    res.status(200).json({
      success: true,
      data: {
        user: userData,
        ...userData
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  refresh,
  logout,
  getMe
};
