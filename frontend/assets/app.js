const API_BASE = (!window.location.hostname || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:8081/api"
    : "https://bhconferencecalendar.vercel.app/api";

let allEvents = [];
let map;
let markers = [];

// DOM Elements
const searchInput = document.getElementById('search-input');
const filterTopic = document.getElementById('filter-topic');
const filterCity = document.getElementById('filter-city');
const filterCountry = document.getElementById('filter-country');
const filterDate = document.getElementById('filter-date');
const btnReset = document.getElementById('btn-reset');

const btnViewMap = document.getElementById('btn-view-map');
const btnViewList = document.getElementById('btn-view-list');
const mapContainer = document.getElementById('map-container');
const listContainer = document.getElementById('list-container');
const navHome = document.getElementById('nav-home');
const navMyEvents = document.getElementById('nav-my-events');
const myEventsCount = document.getElementById('my-events-count');
const langToggle = document.getElementById('lang-toggle');
const btnUpcoming = document.getElementById('btn-upcoming');

// Current Language
let currentLang = 'en';

// State
let filteringToSaved = false;
let filteringToUpcoming = false;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    await loadEvents();
    setupFilters();
    setupLocalization();
    updateUIText(); // Ensure initial text is set
    checkReminders();
    setupNavigation();
    setupScroll();

    // Ensure count is updated on load. 
    // If user specifically wants 0 by default, they might have old test data.
    // Resetting once to be sure.
    if (!localStorage.getItem('myEvents_reset_v2')) {
        localStorage.removeItem('myEvents');
        localStorage.setItem('myEvents_reset_v2', 'true');
    }
    updateMyEventsCount();
});

// --- Map Logic ---
function initMap() {
    const worldBounds = L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180));

    map = L.map('map', {
        minZoom: 2.2, // Prevents world from becoming too small for the container
        maxBounds: worldBounds,
        maxBoundsViscosity: 1.0, // Firmly locks the map within bounds
        worldCopyJump: false
    }).setView([20, 0], 2.2);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
        noWrap: true,
        bounds: worldBounds
    }).addTo(map);
}

// --- Data Fetching ---
async function loadEvents() {
    try {
        const response = await fetch(`${API_BASE}/events`);
        allEvents = await response.json();
        renderEvents(allEvents);
        setupTypeahead();
    } catch (err) {
        console.error("Failed to load events", err);
    }
}

// --- Rendering ---
function renderEvents(events) {
    // 1. Clear Map Markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    // 2. Clear List
    listContainer.innerHTML = '';

    if (events.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding:20px;">${getTrans('msg-no-events')}</div>`;
        return;
    }

    // Group events by coordinate key "lat,lng" for map markers
    const groups = {};

    events.forEach(event => {
        // 1. Add to List (Individual events always shown)
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <div class="event-info">
                <h3>${event.eventName}</h3>
                <p><strong>Topic:</strong> ${event.topic} | <strong>Date:</strong> ${event.startDate}</p>
                <p><strong>Location:</strong> ${event.city}, ${event.country}</p>
                <p>${event.description || ''}</p>
            </div>
            <div class="event-actions">
                <a href="${event.registrationUrl}" target="_blank" class="btn primary">${getTrans('btn-register')}</a>
                <button class="btn btn-interest" data-id="${event.id}">
                   ${isSaved(event.id) ? getTrans('btn-saved') : getTrans('btn-save')}
                </button>
            </div>
        `;
        listContainer.appendChild(card);

        // 2. Prepare for Grouping on Map
        if (event.lat && event.lng) {
            const key = `${event.lat.toFixed(6)},${event.lng.toFixed(6)}`;
            if (!groups[key]) {
                groups[key] = {
                    lat: event.lat,
                    lng: event.lng,
                    city: event.city || "Various",
                    events: []
                };
            }
            groups[key].events.push(event);
        }
    });

    // 3. Create Markers for Groups
    Object.values(groups).forEach(group => {
        const anyUpcoming = group.events.some(e => checkIsUpcoming(e.startDate));
        const marker = L.marker([group.lat, group.lng]).addTo(map);

        if (anyUpcoming && filteringToUpcoming) {
            L.DomUtil.addClass(marker._icon, 'marker-blink');
        }

        // Build Popup Content with professional light styling
        let popupContent = `<div style="max-height: 350px; overflow-y: auto; min-width: 250px; color: #333; padding-right:5px; font-family: 'Inter', sans-serif;">`;

        group.events.forEach((event, idx) => {
            const isLast = idx === group.events.length - 1;
            popupContent += `
                <div style="margin-bottom: ${isLast ? '0' : '15px'}; ${isLast ? '' : 'border-bottom: 1px solid #eee; padding-bottom: 15px;'}">
                    <h3 style="margin:0 0 8px 0; font-size:1.1em; color:#2c3e50; font-weight:700;">${event.eventName}</h3>
                    
                    <div style="font-size:0.85em; line-height:1.5; margin-bottom: 10px;">
                        <span style="color:#7f8c8d; font-weight:600;">Topic:</span> ${event.topic}<br>
                        <span style="color:#7f8c8d; font-weight:600;">Date:</span> ${event.startDate} ${event.endDate && event.endDate !== event.startDate ? ' - ' + event.endDate : ''}<br>
                        <span style="color:#7f8c8d; font-weight:600;">Location:</span> ${event.city}, ${event.country}
                    </div>

                    ${event.description ? `
                    <div style="margin-bottom:12px; font-size:0.8em; color:#555; line-height:1.4; background: #f9f9f9; padding: 8px; border-radius: 4px; border-left: 2px solid #ddd;">
                        ${event.description}
                    </div>` : ''}

                    <div style="margin-top: 10px; display:flex; gap:5px;">
                        <a href="${event.registrationUrl}" target="_blank" class="btn primary" style="flex:1; padding:7px 5px; font-size:0.85em; text-decoration:none; border-radius:4px; text-align:center; font-weight:600; background:#3498db; color:white;">
                            ${getTrans('btn-register')}
                        </a>
                        <button class="btn btn-interest" data-id="${event.id}" style="flex:1; padding:7px 5px; font-size:0.85em; border-radius:4px; cursor:pointer;">
                            ${isSaved(event.id) ? getTrans('btn-saved') : getTrans('btn-save')}
                        </button>
                    </div>
                </div>
            `;
        });
        popupContent += `</div>`;

        marker.bindPopup(popupContent, {
            maxWidth: 320
        });
        markers.push(marker);
    });

    // Re-attach listeners for dynamically created list items
    // (Note: Map popups are harder because they are creating on the fly by Leaflet, 
    // better to delegate from document)
}

// Global Event Delegation for Dynamic Elements
document.addEventListener('click', (e) => {
    // Check if clicked element or parent is the interest button
    const btn = e.target.closest('.btn-interest');
    if (btn) {
        console.log("Button clicked:", btn);
        const id = btn.getAttribute('data-id');
        if (id) {
            window.handleShowInterest(id);
        }
    }
});

function checkIsUpcoming(startDateStr) {
    if (!startDateStr) return false;
    const today = new Date();
    const eventDate = new Date(startDateStr);
    const twoMonthsLater = new Date();
    twoMonthsLater.setMonth(today.getMonth() + 2);
    return eventDate >= today && eventDate <= twoMonthsLater;
}

// --- Filtering Logic ---
function filterEvents() {
    const term = searchInput.value.toLowerCase();
    const topic = filterTopic.value.toLowerCase();
    const city = filterCity.value.toLowerCase();
    const country = filterCountry.value.toLowerCase();
    const date = filterDate.value;

    let filtered = allEvents.filter(ev => {
        const matchesTerm = ev.eventName.toLowerCase().includes(term) || (ev.description || '').toLowerCase().includes(term);
        const matchesTopic = !topic || ev.topic.toLowerCase().includes(topic);
        const matchesCity = !city || ev.city.toLowerCase().includes(city);
        const matchesCountry = !country || ev.country.toLowerCase().includes(country);

        let matchesDate = true;
        if (date) {
            // date input is YYYY-MM
            matchesDate = ev.startDate && ev.startDate.startsWith(date);
        }

        return matchesTerm && matchesTopic && matchesCity && matchesCountry && matchesDate;
    });

    if (filteringToSaved) {
        const savedIds = getSavedEvents();
        filtered = filtered.filter(ev => savedIds.includes(ev.id));
    }

    if (filteringToUpcoming) {
        filtered = filtered.filter(ev => checkIsUpcoming(ev.startDate));
    }

    renderEvents(filtered);

    // Dynamic Filtering Update (Cascading lookups?)
    // User requested: "If the user selects “AI” as a topic, subsequent fields should only display data related to AI conferences."
    // Ideally we re-calculate suggestions here based on 'filtered' subset.
    updateTypeaheadSources(filtered);
}

function setupFilters() {
    [searchInput, filterTopic, filterCity, filterCountry, filterDate].forEach(el => {
        el.addEventListener('input', filterEvents);
    });

    btnReset.addEventListener('click', () => {
        searchInput.value = '';
        filterTopic.value = '';
        filterCity.value = '';
        filterCountry.value = '';
        filterDate.value = '';
        filteringToUpcoming = false;
        filteringToSaved = false;
        navHome.classList.add('active');
        navMyEvents.classList.remove('active');
        btnUpcoming.classList.remove('primary');
        filterEvents();
    });

    btnUpcoming.addEventListener('click', () => {
        filteringToSaved = false; // Reset interests when switching to main views
        navHome.classList.add('active');
        navMyEvents.classList.remove('active');

        filteringToUpcoming = !filteringToUpcoming;
        updateUpcomingButtonStyle();
        filterEvents();
    });
}

function updateUpcomingButtonStyle() {
    const isMapActive = btnViewMap.classList.contains('primary');

    // Remove both view classes first
    btnUpcoming.classList.remove('map-view', 'list-view');

    if (filteringToUpcoming) {
        if (isMapActive) {
            btnUpcoming.classList.add('map-view');
        } else {
            btnUpcoming.classList.add('list-view');
        }
    }
}

// --- Typeahead / Autocomplete ---
// Simple implementation: Show list under input when typing
function setupTypeahead() {
    // Initial setup with all events
    updateTypeaheadSources(allEvents);
}

function updateTypeaheadSources(subset) {
    const topics = new Set(subset.map(e => e.topic).filter(Boolean));
    const cities = new Set(subset.map(e => e.city).filter(Boolean));
    const countries = new Set(subset.map(e => e.country).filter(Boolean));

    attachTypeahead(filterTopic, Array.from(topics), 'suggestions-topic');
    attachTypeahead(filterCity, Array.from(cities), 'suggestions-city');
    attachTypeahead(filterCountry, Array.from(countries), 'suggestions-country');
}

function attachTypeahead(input, sourceData, listId) {
    const list = document.getElementById(listId);

    // Input Handler
    input.onfocus = () => showSuggestions(input.value);
    input.oninput = () => showSuggestions(input.value);

    // Blur handler (delay to allow click)
    input.onblur = () => setTimeout(() => list.style.display = 'none', 200);

    function showSuggestions(val) {
        list.innerHTML = '';
        if (sourceData.length === 0) return;

        const matches = sourceData.filter(item => item.toLowerCase().includes(val.toLowerCase()));

        if (matches.length > 0) {
            matches.slice(0, 10).forEach(match => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = match;
                div.onclick = () => {
                    input.value = match;
                    list.style.display = 'none';
                    filterEvents(); // Trigger filter immediately
                };
                list.appendChild(div);
            });
            list.style.display = 'block';
        } else {
            list.style.display = 'none';
        }
    }
}

// --- My Events (Local Storage) ---
function getSavedEvents() {
    return JSON.parse(localStorage.getItem('myEvents') || '[]');
}

function isSaved(id) {
    return getSavedEvents().includes(id);
}

// Make handleShowInterest globally accessible
window.handleShowInterest = function (id) {
    console.log("handleShowInterest called for ID:", id);
    if (isSaved(id)) {
        alert(getTrans('msg-already-saved'));
        return;
    }
    const event = allEvents.find(e => e.id === id);
    if (event) {
        openInterestModal(event);
    } else {
        console.error("Event not found for ID:", id);
    }
};

// --- Interest Modal Logic ---
function openInterestModal(event) {
    const modal = document.getElementById('interest-modal');
    const nameLabel = document.getElementById('modal-event-name');
    const idInput = document.getElementById('modal-event-id');

    if (modal && nameLabel && idInput) {
        nameLabel.textContent = event.eventName;
        idInput.value = event.id;
        modal.style.display = 'flex'; // Changed to flex to match new CSS
    }
}

function closeInterestModal() {
    const modal = document.getElementById('interest-modal');
    const form = document.getElementById('interest-form');
    if (modal) modal.style.display = 'none';
    if (form) form.reset();
}

// Initialize Modal Listeners
document.addEventListener('DOMContentLoaded', () => {
    const interestForm = document.getElementById('interest-form');
    const closeModalBtn = document.getElementById('close-modal');

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeInterestModal);
    }

    if (interestForm) {
        interestForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = interestForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = "Submitting...";
            submitBtn.disabled = true;

            const data = {
                firstName: document.getElementById('int-fname').value,
                lastName: document.getElementById('int-lname').value,
                username: document.getElementById('int-username').value,
                email: document.getElementById('int-email').value,
                role: document.getElementById('int-role').value,
                city: document.getElementById('int-city').value,
                country: document.getElementById('int-country').value,
                eventId: document.getElementById('modal-event-id').value,
                confirmed: document.getElementById('int-confirm').checked,
                consent: document.getElementById('int-consent').checked
            };

            try {
                const response = await fetch(`${API_BASE}/interest`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (result.status === 'success') {
                    alert(getTrans('msg-saved'));
                    saveLocally(data.eventId);
                    closeInterestModal();
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (err) {
                console.error("Submission error:", err);
                alert('Failed to submit interest. Please try again.');
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }
});

function saveLocally(id) {
    let saved = getSavedEvents();
    if (!saved.includes(id)) {
        saved.push(id);
        localStorage.setItem('myEvents', JSON.stringify(saved));
        updateMyEventsCount();
        filterEvents(); // Re-render to update button state
    }
}

/* 
   Deprecated regular toggle. 
   Keeping helper utils but removing old toggleMyEvent 
*/

function updateMyEventsCount() {
    myEventsCount.textContent = getSavedEvents().length;
}

// --- View Toggles ---
btnViewMap.addEventListener('click', () => {
    filteringToSaved = false;
    navHome.classList.add('active');
    navMyEvents.classList.remove('active');

    mapContainer.style.display = 'block';
    listContainer.style.display = 'none';
    btnViewMap.classList.add('primary');
    btnViewList.classList.remove('primary');
    updateUpcomingButtonStyle();
    filterEvents(); // Re-filter without saved filter
    setTimeout(() => map.invalidateSize(), 100);
});

btnViewList.addEventListener('click', () => {
    filteringToSaved = false;
    navHome.classList.add('active');
    navMyEvents.classList.remove('active');

    mapContainer.style.display = 'none';
    listContainer.style.display = 'flex';
    btnViewList.classList.add('primary');
    btnViewMap.classList.remove('primary');
    updateUpcomingButtonStyle();
    filterEvents(); // Re-filter without saved filter
});

// --- Navigation ---
function setupNavigation() {
    navHome.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // No longer re-locking to avoid freezing issues
        document.body.classList.remove('no-scroll');

        // Reset all filter inputs
        searchInput.value = '';
        filterTopic.value = '';
        filterCity.value = '';
        filterCountry.value = '';
        filterDate.value = '';

        filteringToSaved = false;
        filteringToUpcoming = false;

        navHome.classList.add('active');
        navMyEvents.classList.remove('active');
        btnUpcoming.classList.remove('primary');
        updateUpcomingButtonStyle();

        btnViewMap.click();
        filterEvents();
    });

    // Anchor links for portal
    document.querySelectorAll('.nav-links a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            if (!targetId) return;
            const target = document.getElementById(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    });

    navMyEvents.addEventListener('click', (e) => {
        e.preventDefault();
        filteringToSaved = true;
        filteringToUpcoming = false; // Reset upcoming when viewing all interests

        navMyEvents.classList.add('active');
        navHome.classList.remove('active');
        btnUpcoming.classList.remove('primary');
        updateUpcomingButtonStyle();

        // Show List View layout without triggering the reset logic in btnViewList
        mapContainer.style.display = 'none';
        listContainer.style.display = 'flex';
        btnViewList.classList.add('primary');
        btnViewMap.classList.remove('primary');

        filterEvents();
    });
}


// --- Localization Logic ---
function setupLocalization() {
    langToggle.addEventListener('change', (e) => {
        currentLang = e.target.value;
        updateUIText();
        // Re-render to update dynamic buttons (Register/Save)
        renderEvents(allEvents); // Or filterEvents() to preserve filter state
    });
}

function updateUIText() {
    const t = translations[currentLang];
    if (!t) return;

    // Update text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        if (t[key]) el.placeholder = t[key];
    });
}

function getTrans(key) {
    return (translations[currentLang] && translations[currentLang][key]) || key;
}

// --- Scroll Handling ---
function setupScroll() {
    const btnScrollTop = document.getElementById('btn-scroll-top');
    if (!btnScrollTop) return;

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            btnScrollTop.classList.add('visible');
        } else {
            btnScrollTop.classList.remove('visible');
        }

        // Auto-unlock scroll if user manages to scroll down 
        // (backup in case they don't click Explore Now)
        if (window.pageYOffset > 50 && document.body.classList.contains('no-scroll')) {
            document.body.classList.remove('no-scroll');
        }
    });

    btnScrollTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// --- Reminders ---
function checkReminders() {
    const savedIds = getSavedEvents();
    if (savedIds.length === 0) return;

    const today = new Date();
    // Look ahead 7 days max
    const upcoming = [];

    allEvents.forEach(ev => {
        if (savedIds.includes(ev.id)) {
            const eventDate = new Date(ev.startDate);
            const diffTime = eventDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= 0 && diffDays <= 7) {
                upcoming.push(`${ev.eventName} (${diffDays === 0 ? 'Today' : 'in ' + diffDays + ' days'})`);
            }
        }
    });

    if (upcoming.length > 0) {
        // Simple alert for MVP, or could be a nice modal
        setTimeout(() => {
            alert(`📅 Upcoming Saved Events:\n\n${upcoming.join('\n')}`);
        }, 1000);
    }
}

// --- Utils ---
// Dummy Coordinator Map for Demo
const CITY_COORDS = {
    "london": [51.505, -0.09],
    "paris": [48.8566, 2.3522],
    "new york": [40.7128, -74.0060],
    "san francisco": [37.7749, -122.4194],
    "tokyo": [35.6762, 139.6503],
    "berlin": [52.5200, 13.4050],
    "sydney": [-33.8688, 151.2093],
    "mumbai": [19.0760, 72.8777],
    "dubai": [25.2048, 55.2708],
    "singapore": [1.3521, 103.8198]
};

function getCityCoordinates(city, country) {
    if (!city) return null;
    const key = city.toLowerCase();
    if (CITY_COORDS[key]) return CITY_COORDS[key];

    // Fallback: Random offset to show it exists on a 'world map' 
    // In real app -> Geocoding API
    // Return null if unknown to avoid cluttering 0,0
    return null;
}
