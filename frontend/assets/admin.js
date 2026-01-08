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

        // Summary Stats Elements
        const statTotalInterests = document.getElementById('stat-total-interests');
        const statActiveEvents = document.getElementById('stat-active-events');
        const statTotalFees = document.getElementById('stat-total-fees');

        // Calculate Stats
        let totalInterests = 0;
        let totalFees = 0;
        let activeEvents = data.length;

        interestsTableBody.innerHTML = '';
        if (data.length === 0) {
            interestsTableBody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; opacity: 0.6;">No interest submissions yet.</td></tr>`;
            if (statTotalInterests) statTotalInterests.textContent = '0';
            if (statActiveEvents) statActiveEvents.textContent = '0';
            if (statTotalFees) statTotalFees.textContent = '$0';
            return;
        }

        data.forEach(item => {
            totalInterests += item['No. of interests'] || 0;

            // Parse Total string "$1,234.0" to number
            const rawTotal = String(item['Total'] || '0').replace(/[$,]/g, '');
            totalFees += parseFloat(rawTotal) || 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${item['Event Name']}</strong></td>
                <td>${item['Fees']}</td>
                <td style="text-align: center;">${item['No. of interests']}</td>
                <td>${item['Total']}</td>
                <td>
                    <button class="btn admin-btn-clear" data-event-name="${item['Event Name']}">
                        Clear
                    </button>
                </td>
            `;
            interestsTableBody.appendChild(row);
        });

        // Update Stats UI
        if (statTotalInterests) statTotalInterests.textContent = totalInterests.toLocaleString();
        if (statActiveEvents) statActiveEvents.textContent = activeEvents.toLocaleString();
        if (statTotalFees) statTotalFees.textContent = `$${totalFees.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    } catch (e) {
        console.error("Failed to load interests:", e);
        interestsTableBody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #ff6b6b;">Error loading data.</td></tr>`;
    }
}

// Event Delegation for Clear Buttons
if (interestsTableBody) {
    interestsTableBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('admin-btn-clear')) {
            const eventName = e.target.getAttribute('data-event-name');
            if (confirm(`Are you sure you want to CLEAR all interests for "${eventName}"? This action cannot be undone.`)) {
                await clearInterests(eventName);
            }
        }
    });
}

async function clearInterests(eventName) {
    try {
        const res = await fetch(`${API_BASE}/interest/clear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminSecret: authToken,
                eventName: eventName
            })
        });

        const result = await res.json();
        if (res.ok) {
            alert(result.message);
            loadInterests(); // Reload table
        } else {
            alert(`Error: ${result.detail || result.message}`);
        }
    } catch (e) {
        alert(`Network Error: ${e.message}`);
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
