const fs = require('fs');
const path = require('path');

const loginPath = path.join(__dirname, '..', 'src', 'public', 'login.html');
let code = fs.readFileSync(loginPath, 'utf8');

const target = `                    const data = await res.json();
                    if (data.success && data.data && data.data.token) {
                        localStorage.setItem('life_pms_token', data.data.token);
                        localStorage.setItem('life_pms_user', JSON.stringify(data.data.user));
                        showToast('✓ Signed in successfully! Redirecting...', 'success');
                        setTimeout(() => {
                            window.location.href = getRedirectUrl();
                        }, 400);
                    } else {
                        showToast(data.error || 'Invalid username/email or password.', 'error');
                        btn.disabled = false;
                        btn.textContent = 'Sign In';
                    }`;

const replacement = `                    const data = await res.json();
                    if (data.success && data.data && data.data.token) {
                        localStorage.setItem('life_pms_token', data.data.token);
                        localStorage.setItem('life_pms_user', JSON.stringify(data.data.user));

                        // Dual-authenticate Firebase Auth client in browser session
                        const userEmail = data.data.user?.email || (identifier.includes('@') ? identifier : (identifier + '@zoho.com'));
                        if (window.firebaseAuthClient?.firebaseSignInWithCredentials && userEmail) {
                            try {
                                await window.firebaseAuthClient.firebaseSignInWithCredentials(userEmail, password);
                            } catch (e) {}
                        }

                        showToast('✓ Signed in successfully! Redirecting...', 'success');
                        setTimeout(() => {
                            window.location.href = getRedirectUrl();
                        }, 400);
                    } else {
                        showToast(data.error || 'Invalid username/email or password.', 'error');
                        btn.disabled = false;
                        btn.textContent = 'Sign In';
                    }`;

if (code.includes('dual-authenticate Firebase Auth client in browser session') || code.includes('Dual-authenticate Firebase Auth')) {
    console.log('login.html already patched');
} else {
    code = code.replace(target, replacement);
    fs.writeFileSync(loginPath, code, 'utf8');
    console.log('✓ Successfully patched src/public/login.html');
}
