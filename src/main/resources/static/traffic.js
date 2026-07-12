let trafficDataCache = [];
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

// The Deduplication Engine: Guarantees only ONE entry per Light ID exists in the cache
function mergeIntoCache(incomingData) {
    let incomingArray = Array.isArray(incomingData) ? incomingData : [incomingData];
    let uiNeedsRebuild = false;

    incomingArray.forEach(newLight => {
        // Failsafe: Checks for either 'trafficLightId' or 'id' to prevent undefined errors
        let targetId = String(newLight.trafficLightId || newLight.id);
        
        let existingIndex = trafficDataCache.findIndex(
            light => String(light.trafficLightId || light.id) === targetId
        );

        if (existingIndex !== -1) {
            // Light exists. Overwrite the old log with this new log.
            if (trafficDataCache[existingIndex].status !== newLight.status) {
                uiNeedsRebuild = true;
            }
            trafficDataCache[existingIndex] = newLight;
        } else {
            // Brand new light ID, add it to the cache
            trafficDataCache.push(newLight);
            uiNeedsRebuild = true;
        }
    });

    return uiNeedsRebuild;
}

function fetchInitialData() {
    fetch('/api/traffic/initial-data')
        .then(response => response.json())
        .then(data => {
            // 1. Pass the initial database load through our Deduplication Engine
            trafficDataCache = []; // Clear any garbage
            mergeIntoCache(data);
            
            // 2. Set Server Offset
            if (trafficDataCache.length > 0 && trafficDataCache[0].serverTimeMs) {
                serverClockOffset = trafficDataCache[0].serverTimeMs - Date.now();
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
            let newData = JSON.parse(response.body);

            // Pass the WebSocket update through the exact same Deduplication Engine
            let requiresRebuild = mergeIntoCache(newData);
            
            // Recalibrate clock
            let dataArray = Array.isArray(newData) ? newData : [newData];
            if (dataArray.length > 0 && dataArray[0].serverTimeMs) {
                serverClockOffset = dataArray[0].serverTimeMs - Date.now();
            }
            
            if (requiresRebuild) {
                buildDashboardUI();
            }
        });
    });
}

function buildDashboardUI() {
    const container = document.getElementById("traffic-container");
    if (!container) return; 
    
    container.innerHTML = ""; 
    let activeCount = 0;

    trafficDataCache.forEach(light => {
        if (light.status.toUpperCase() !== "ACTIVE") return;
        activeCount++;

        let lightId = light.trafficLightId || light.id; // Failsafe ID grabber

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

    trafficDataCache.forEach(light => {
        if (light.status.toUpperCase() !== "ACTIVE") return;

        let lightId = light.trafficLightId || light.id;

        let safeTime = light.startTime.padStart(8, '0');
        let dateString = `${light.date}T${safeTime}`;
        let startMs = new Date(dateString).getTime();

        if (isNaN(startMs)) {
            updateCardUI(lightId, "status-inactive", "DATE ERROR", "--");
            return; 
        }

        let elapsedMs = now - startMs;
        
        if (elapsedMs < 0) {
            updateCardUI(lightId, "status-inactive", "WAITING", "T-Minus");
            return;
        }

        let elapsedSeconds = Math.floor(elapsedMs / 1000);

        let gTime = light.durationGreen;
        let yTime = light.durationYellow;
        let rTime = light.durationRed;
        let totalCycle = gTime + yTime + rTime;
        
        if (totalCycle === 0) return; 

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