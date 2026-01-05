const API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:8081/api/admin"
    : "https://bhconferencecalendar.vercel.app/api/admin";

const authOverlay = document.getElementById('auth-overlay');
const adminPassInput = document.getElementById('admin-pass');
const btnLogin = document.getElementById('btn-login');
const loginError = document.getElementById('login-error');
const adminContent = document.getElementById('admin-content');
const btnLogout = document.getElementById('btn-logout');

const fileUpload = document.getElementById('file-upload');
const btnUpload = document.getElementById('btn-upload');
const uploadStatus = document.getElementById('upload-status');
const uploadSpinner = document.getElementById('upload-spinner');

const btnReGeocode = document.getElementById('btn-re-geocode');
const geocodeStatus = document.getElementById('geocode-status');
const geocodeSpinner = document.getElementById('geocode-spinner');
const btnDownloadInterests = document.getElementById('btn-download-interests');

// Stats Elements
const statTotal = document.getElementById('stat-total');
const statTopics = document.getElementById('stat-topics');
const statCountries = document.getElementById('stat-countries');

// Auth State
let authToken = sessionStorage.getItem('adminToken');

if (authToken) {
    showAdminInterface();
}

btnLogin.addEventListener('click', () => {
    const pass = adminPassInput.value;
    if (pass) {
        // Optimistic check, real validation happens on API call
        // But for UI blocking, we just store it
        sessionStorage.setItem('adminToken', pass);
        authToken = pass;
        showAdminInterface();
    }
});

btnLogout.addEventListener('click', () => {
    sessionStorage.removeItem('adminToken');
    location.reload();
});

function showAdminInterface() {
    authOverlay.style.display = 'none';
    adminContent.style.filter = 'none';
    adminContent.style.pointerEvents = 'auto';
    loadStats();
}

async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/stats?passphrase=${authToken}`);
        if (res.status === 401) {
            handleAuthFail();
            return;
        }
        const data = await res.json();
        statTotal.textContent = data.total_events;
        statTopics.textContent = data.topics;
        statCountries.textContent = data.countries;
    } catch (e) {
        console.error(e);
    }
}

btnUpload.addEventListener('click', async () => {
    const file = fileUpload.files[0];
    if (!file) {
        alert("Please select a file first.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    uploadStatus.textContent = '';
    uploadStatus.className = '';
    uploadSpinner.style.display = 'block';

    try {
        const res = await fetch(`${API_BASE}/upload?passphrase=${authToken}`, {
            method: 'POST',
            body: formData
        });

        uploadSpinner.style.display = 'none';
        const result = await res.json();

        if (res.ok) {
            uploadStatus.textContent = `✅ Success: ${result.message}`;
            uploadStatus.style.background = 'rgba(0, 255, 0, 0.1)';
            uploadStatus.style.color = '#4ade80';
            loadStats(); // refresh stats
        } else {
            uploadStatus.textContent = `❌ Error: ${result.detail || result.message}`;
            uploadStatus.style.background = 'rgba(255, 0, 0, 0.1)';
            uploadStatus.style.color = '#ff6b6b';
            if (res.status === 401) handleAuthFail();
        }

    } catch (e) {
        uploadSpinner.style.display = 'none';
        uploadStatus.textContent = `❌ Network Error: ${e.message}`;
    }
});


btnReGeocode.addEventListener('click', async () => {
    if (!confirm("Are you sure you want to re-geocode all events with missing coordinates? This may take some time.")) {
        return;
    }

    geocodeStatus.textContent = '';
    geocodeStatus.className = '';
    geocodeSpinner.style.display = 'block';

    try {
        const res = await fetch(`${API_BASE}/re-geocode?passphrase=${authToken}`, {
            method: 'POST'
        });

        console.log("Re-geocode response status:", res.status);
        geocodeSpinner.style.display = 'none';
        const result = await res.json();
        console.log("Re-geocode result:", result);

        if (res.ok) {
            geocodeStatus.textContent = `✅ Result: ${result.geocoded} geocoded, ${result.failed} failed, ${result.total} total.`;
            geocodeStatus.style.background = 'rgba(0, 255, 0, 0.1)';
            geocodeStatus.style.color = '#4ade80';

            // Display Failures
            if (result.failures && result.failures.length > 0) {
                const failList = document.createElement('div');
                failList.style.marginTop = '15px';
                failList.style.background = 'rgba(0,0,0,0.2)';
                failList.style.padding = '10px';
                failList.style.borderRadius = '8px';

                failList.innerHTML = `<h4 style="margin-bottom:10px; color:#ff6b6b;">Failed Items:</h4>`;

                const ul = document.createElement('ul');
                ul.style.listStyle = 'none';
                ul.style.paddingLeft = '0';

                result.failures.forEach(fail => {
                    const li = document.createElement('li');
                    li.style.marginBottom = '8px';
                    li.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
                    li.style.paddingBottom = '4px';
                    li.innerHTML = `
                        <strong style="color:white;">${fail.eventName}</strong><br>
                        <span style="opacity:0.7; font-size:0.9em;">Loc: "${fail.location}"</span> 
                        <span style="color:#ff6b6b; font-size:0.9em;">(${fail.reason})</span>
                    `;
                    ul.appendChild(li);
                });

                failList.appendChild(ul);
                geocodeStatus.appendChild(failList);
            }

            loadStats(); // refresh stats
        } else {
            geocodeStatus.textContent = `❌ Error: ${result.detail || result.message}`;
            geocodeStatus.style.background = 'rgba(255, 0, 0, 0.1)';
            geocodeStatus.style.color = '#ff6b6b';
            if (res.status === 401) handleAuthFail();
        }

    } catch (e) {
        geocodeSpinner.style.display = 'none';
        geocodeStatus.textContent = `❌ Network Error: ${e.message}`;
    }
});

btnDownloadInterests.addEventListener('click', () => {
    if (!authToken) {
        handleAuthFail();
        return;
    }
    // Direct link trigger for file download
    const url = `${API_BASE}/download-interests?passphrase=${authToken}`;
    window.open(url, '_blank');
});

function handleAuthFail() {
    sessionStorage.removeItem('adminToken');
    alert("Session expired or invalid passphrase.");
    location.reload();
}
