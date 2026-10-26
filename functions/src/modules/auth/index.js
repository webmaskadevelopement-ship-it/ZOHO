const AuthValidationService = require('./authValidation');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { db } = require('../../config/firebase');

// Callable Cloud Function: Validate Login
const validateLoginCallable = onCall(async (request) => {
    const { email, name, role } = request.data || {};
    try {
        return await AuthValidationService.validateLogin({ email, name, role, db });
    } catch (err) {
        throw new HttpsError('invalid-argument', err.message);
    }
});

// Callable Cloud Function: Validate Google Login
const validateGoogleLoginCallable = onCall(async (request) => {
    const { email, name, idToken, role } = request.data || {};
    try {
        return await AuthValidationService.validateGoogleLogin({ email, name, idToken, role, db });
    } catch (err) {
        throw new HttpsError('permission-denied', err.message);
    }
});

module.exports = {
    AuthValidationService,
    validateLoginCallable,
    validateGoogleLoginCallable
};
