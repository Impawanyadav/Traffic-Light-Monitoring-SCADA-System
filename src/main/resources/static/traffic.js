
let trafficDataCache = {}; 
let stompClient = null;
let serverClockOffset = 0; 

document.addEventListener("DOMContentLoaded", function() {
    fetchInitialData();
    connectWebSocket();
    setInterval(edgeComputeTimers, 1000);
    
    setInterval(() => {
        let clockEl = document.getElementById("system-clock");
        if (clockEl) clockEl.innerText = new Date().toLocaleTimeString();
    }, 1000);
});

function fetchInitialData() {
    fetch('/api/traffic/initial-data')
        .then(response => response.json())
        .then(data => {
            // Because it's a Map, just assign it directly. No loop/search needed.
            trafficDataCache = data; 
            
            let keys = Object.keys(data);
            if (keys.length > 0 && data[keys[0]].serverTimeMs) {
                serverClockOffset = data[keys[0]].serverTimeMs - Date.now();
            }
            
            buildDashboardUI();
        })
        .catch(err => console.error("Failed to fetch initial traffic config", err));
}

function connectWebSocket() {
    let socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = null; 

    stompClient.connect({}, function (frame) {
        stompClient.subscribe('/topic/trafficlogs', function (response) {
            // Replace old Map with the new incoming Map
            let newData = JSON.parse(response.body);
            trafficDataCache = newData; 
            
            let keys = Object.keys(newData);
            if (keys.length > 0 && newData[keys[0]].serverTimeMs) {
                serverClockOffset = newData[keys[0]].serverTimeMs - Date.now();
            }
            
            buildDashboardUI();
        });
    });
}

function buildDashboardUI() {
    const container = document.getElementById("traffic-container");
    if (!container) return; 
    
    container.innerHTML = ""; 
    let activeCount = 0;

    // Iterate over the HashMap values
    Object.values(trafficDataCache).forEach(light => {
        // STRICT FILTER: Display ONLY if Active
        if (!light.status || light.status.toUpperCase() !== "ACTIVE") return;
        
        activeCount++;
        let lightId = light.trafficLightId || light.id; 

        let cardHTML = `
            <div class="col-md-4 col-lg-3">
                <div id="card-${lightId}" class="card text-center h-100 traffic-card status-inactive">
                    <div class="card-body d-flex flex-column justify-content-center">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h5 class="card-title fw-bold m-0">Light ${lightId}</h5>
                            <span class="badge bg-dark border border-secondary">ID: ${lightId}</span>
                        </div>
                        
                        <h3 id="status-${lightId}" class="fw-bold tracking-wider">SYNCING...</h3>
                        <div id="timer-${lightId}" class="timer-display my-2">--</div>
                        
                        <div class="mt-auto pt-3 border-top border-secondary border-opacity-25">
                            <small class="opacity-75">
                                📍 Lat: ${light.latitude || 'N/A'} | Lng: ${light.longitude || 'N/A'}
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
    
    if (activeCount === 0) {
        container.innerHTML = `<h5 class="text-muted w-100 text-center mt-5">No active traffic lights found.</h5>`;
    }
    
    edgeComputeTimers();
}

function edgeComputeTimers() {
    let now = Date.now() + serverClockOffset;

    Object.values(trafficDataCache).forEach(light => {
        if (!light.status || light.status.toUpperCase() !== "ACTIVE") return;

        let lightId = light.trafficLightId || light.id;

        // Parse variables for validation
        let safeTime = (light.startTime || "").padStart(8, '0');
        let dateString = `${light.date}T${safeTime}`;
        let startMs = new Date(dateString).getTime();
        
        let gTime = parseInt(light.durationGreen);
        let yTime = parseInt(light.durationYellow);
        let rTime = parseInt(light.durationRed);

        // THE DIAGNOSTIC SHIELD: If ANY data is corrupt, fallback to SYNCING box
        if (isNaN(gTime) || isNaN(yTime) || isNaN(rTime) || isNaN(startMs)) {
            updateCardUI(lightId, "status-inactive", "SYNCING...", "--");
            return; // Halt calculation for this specific card
        }

        let elapsedMs = now - startMs;
        
        if (elapsedMs < 0) {
            updateCardUI(lightId, "status-inactive", "WAITING", "T-Minus");
            return;
        }

        let elapsedSeconds = Math.floor(elapsedMs / 1000);
        let totalCycle = gTime + yTime + rTime;
        
        if (totalCycle === 0) {
            updateCardUI(lightId, "status-inactive", "SYNCING...", "--");
            return; 
        }

        let currentCyclePosition = elapsedSeconds % totalCycle;
        let currentColor = "";
        let timeRemaining = 0;
        let cssClass = "";

        if (currentCyclePosition < gTime) {
            currentColor = "GREEN";
            timeRemaining = gTime - currentCyclePosition;
            cssClass = "status-green";
        } 
        else if (currentCyclePosition < (gTime + yTime)) {
            currentColor = "YELLOW";
            timeRemaining = (gTime + yTime) - currentCyclePosition;
            cssClass = "status-yellow";
        } 
        else {
            currentColor = "RED";
            timeRemaining = totalCycle - currentCyclePosition;
            cssClass = "status-red";
        }

        updateCardUI(lightId, cssClass, currentColor, timeRemaining);
    });
}

function updateCardUI(id, cssClass, statusText, timerText) {
    let cardEl = document.getElementById(`card-${id}`);
    let timerEl = document.getElementById(`timer-${id}`);
    let statusEl = document.getElementById(`status-${id}`);

    if (cardEl && timerEl && statusEl) {
        if (!cardEl.classList.contains(cssClass)) {
            cardEl.className = `card text-center h-100 traffic-card ${cssClass}`;
        }
        statusEl.innerText = statusText;
        timerEl.innerText = timerText < 10 && typeof timerText === 'number' ? `0${timerText}` : timerText;
    }
}