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
const interestsTableBody = document.getElementById('interests-table-body');

// Auth State
let authToken = sessionStorage.getItem('adminToken');

if (authToken) {
    showAdminInterface();
}

if (btnLogin) {
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
}

if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        sessionStorage.removeItem('adminToken');
        location.reload();
    });
}

function showAdminInterface() {
    authOverlay.style.display = 'none';
    adminContent.style.filter = 'none';
    adminContent.style.pointerEvents = 'auto';
    loadStats();
    loadInterests();
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

if (btnUpload) {
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
}


if (btnReGeocode) {
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
}

async function loadInterests() {
    if (!interestsTableBody) return;
    try {
        const res = await fetch(`${API_BASE}/interests?passphrase=${authToken}`);
        if (res.status === 401) {
            handleAuthFail();
            return;
        }
        const data = await res.json();

        interestsTableBody.innerHTML = '';
        if (data.length === 0) {
            interestsTableBody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; opacity: 0.6;">No interest submissions yet.</td></tr>`;
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            row.innerHTML = `
                <td style="padding: 12px;"><strong>${item['First Name']} ${item['Last Name']}</strong><br><small style="opacity:0.6;">${item['BH Username']}</small></td>
                <td style="padding: 12px;">${item['BH Email']}</td>
                <td style="padding: 12px;">${item['Role'] || '-'}</td>
                <td style="padding: 12px;">${item['City']}, ${item['Country']}</td>
                <td style="padding: 12px;">${item['Event Name']}</td>
                <td style="padding: 12px;">${item['Event Price']}</td>
                <td style="padding: 12px; font-size: 0.8rem; opacity: 0.7; white-space:nowrap;">${item['Timestamp']}</td>
            `;
            interestsTableBody.appendChild(row);
        });
    } catch (e) {
        console.error("Failed to load interests:", e);
        interestsTableBody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #ff6b6b;">Error loading data.</td></tr>`;
    }
}

if (btnDownloadInterests) {
    btnDownloadInterests.addEventListener('click', () => {
        if (!authToken) {
            handleAuthFail();
            return;
        }
        // Use a temporary anchor to trigger download with passphrase
        const url = `${API_BASE}/download-interests?passphrase=${authToken}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = 'UserInterests.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
}

function handleAuthFail() {
    sessionStorage.removeItem('adminToken');
    alert("Session expired or invalid passphrase.");
    location.reload();
}
