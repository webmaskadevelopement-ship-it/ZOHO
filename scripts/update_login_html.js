const fs = require('fs');

let html = fs.readFileSync('src/public/login.html', 'utf8');

// 1. Update fetch body to include username
html = html.replace(
    'body: JSON.stringify({ email: identifier, password })',
    'body: JSON.stringify({ email: identifier, username: identifier, password })'
);

// 2. Add Quick Sign-in Chips after the form if not already present
if (!html.includes('id="quickCredChips"')) {
    const quickChipsHtml = `
            <!-- Quick Credentials Helper for Testing & Fast Sign-in -->
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 14px;">
                <div style="font-size:11.5px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:8px;">
                    ⚡ Quick Test Credentials (Click to fill)
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;" id="quickCredChips">
                    <button type="button" class="cred-chip" data-user="ravi.bhadoria" data-pass="Zoho@Ravi#2026" style="background:#fff; border:1px solid #CBD5E1; border-radius:6px; padding:4px 8px; font-size:11.5px; color:#1E293B; cursor:pointer; font-weight:500;">👤 Ravi Bhadoria</button>
                    <button type="button" class="cred-chip" data-user="ananya.gupta" data-pass="Zoho@Anan#2026" style="background:#fff; border:1px solid #CBD5E1; border-radius:6px; padding:4px 8px; font-size:11.5px; color:#1E293B; cursor:pointer; font-weight:500;">👤 Ananya Gupta</button>
                    <button type="button" class="cred-chip" data-user="ineet" data-pass="Zoho@Inee#2026" style="background:#fff; border:1px solid #CBD5E1; border-radius:6px; padding:4px 8px; font-size:11.5px; color:#1E293B; cursor:pointer; font-weight:500;">👤 Ineet</button>
                    <button type="button" class="cred-chip" data-user="nikhil" data-pass="Zoho@Nikh#2026" style="background:#fff; border:1px solid #CBD5E1; border-radius:6px; padding:4px 8px; font-size:11.5px; color:#1E293B; cursor:pointer; font-weight:500;">👤 Nikhil</button>
                    <button type="button" class="cred-chip" data-user="ritika" data-pass="Zoho@Riti#2026" style="background:#fff; border:1px solid #CBD5E1; border-radius:6px; padding:4px 8px; font-size:11.5px; color:#1E293B; cursor:pointer; font-weight:500;">👤 Ritika</button>
                    <button type="button" class="cred-chip" data-user="admin" data-pass="FirebaseManagedAuth2026!" style="background:#EFF6FF; border:1px solid #BFDBFE; border-radius:6px; padding:4px 8px; font-size:11.5px; color:#1D4ED8; cursor:pointer; font-weight:600;">🔑 Admin</button>
                    <button type="button" class="cred-chip" data-user="manager" data-pass="FirebaseManagedAuth2026!" style="background:#F0FDF4; border:1px solid #BBF7D0; border-radius:6px; padding:4px 8px; font-size:11.5px; color:#15803D; cursor:pointer; font-weight:600;">👔 Manager</button>
                </div>
            </div>
`;

    html = html.replace('</form>', '</form>\n' + quickChipsHtml);

    const chipScript = `
            document.querySelectorAll('.cred-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const u = chip.getAttribute('data-user');
                    const p = chip.getAttribute('data-pass');
                    const uInp = document.getElementById('usernameInput');
                    const pInp = document.getElementById('passwordInput');
                    if (uInp && pInp) {
                        uInp.value = u;
                        pInp.value = p;
                        uInp.focus();
                    }
                });
            });
`;

    html = html.replace("document.getElementById('loginForm')", chipScript + "\n            document.getElementById('loginForm')");
}

fs.writeFileSync('src/public/login.html', html, 'utf8');
console.log('Successfully updated src/public/login.html');

