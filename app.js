// Globale System-Variablen
let anchorTimeMs = null;
let clockInterval = null;
let globalLat = null; // Für das Sonnen-Canvas
let globalLng = null; // Für das Sonnen-Canvas

// Hauptfunktion: Initialisiert die Uhr basierend auf bereitgestellten Koordinaten
function initDecTime(position) {
    globalLat = position.coords.latitude;
    globalLng = position.coords.longitude;
    const lat = globalLat;
    const lng = globalLng;
    
    // UI aktualisieren und manuelles Menü verstecken (falls es offen war)
    document.getElementById("location-display").innerHTML = `Lat: ${lat.toFixed(4)}°, Lng: ${lng.toFixed(4)}°`;
    document.getElementById("manual-location").style.display = "none";

    // Astronomische Berechnung
    const now = new Date();
    const times = SunCalc.getTimes(now, lat, lng);
    
    let anchorTypeStr = "";

    // Logik-Weiche: Polar-Fallback (ab 65° oder fehlendem Sonnenaufgang)
    if (Math.abs(lat) >= 65 || isNaN(times.sunrise.getTime())) {
        anchorTimeMs = times.nadir.getTime();
        anchorTypeStr = "Nadir (Polar-Fallback aktiv)";
    } else {
        anchorTimeMs = times.sunrise.getTime();
        anchorTypeStr = "Sonnenaufgang (Standard)";
    }
    
    document.getElementById("anchor-type").innerText = anchorTypeStr;

    // Timer zurücksetzen, um doppelte Taktungen bei manuellem Standortwechsel zu vermeiden
    if (clockInterval) clearInterval(clockInterval);
    
    // Taktung: 1 Mean DecTime-Sekunde = 864 Millisekunden
    clockInterval = setInterval(calculateAndRenderDecTime, 864);
    calculateAndRenderDecTime(); 
}

// Render-Schleife: Berechnet die Differenz und aktualisiert das UI
function calculateAndRenderDecTime() {
    if (!anchorTimeMs) return;

    const nowMs = Date.now();
    let diffMs = nowMs - anchorTimeMs;

    // Tages-Überlauf korrigieren (Falls die aktuelle Zeit vor dem heutigen Ankerpunkt liegt)
    if (diffMs < 0) {
        diffMs += 86400000; // + 24 Standard-Stunden in Millisekunden
    }

    // Mathematische Umrechnung in Dezimalzeit
    const totalDecSeconds = Math.floor(diffMs / 864);
    const decHours = Math.floor(totalDecSeconds / 10000);
    const remainderAfterHours = totalDecSeconds % 10000;
    const decMinutes = Math.floor(remainderAfterHours / 100);
    const decSeconds = remainderAfterHours % 100;

    // Führende Nullen hinzufügen
    const format = (num) => num.toString().padStart(2, '0');
    
    document.getElementById("dectime-display").innerText = 
        `${decHours}.${format(decMinutes)}.${format(decSeconds)}`;
        
    // Aufruf der dynamischen Visualisierung
    drawSunPath();
}

// Fallback-Stufe 2 & 3: IP-Ortung (via ipapi.co) und Manuelle Eingabe
async function handleGpsError(error) {
    document.getElementById("location-display").innerText = "GPS blockiert. Versuche IP-Ortung...";

    try {
        // Stufe 2: Externe, hochpräzise IP-API abfragen
        const response = await fetch('https://ipapi.co/json/');
        const geoData = await response.json();

        // ipapi.co nennt die Felder 'latitude' und 'longitude'
        if (geoData.latitude && geoData.longitude) {
            const mockPosition = {
                coords: {
                    latitude: parseFloat(geoData.latitude),
                    longitude: parseFloat(geoData.longitude)
                }
            };
            
            initDecTime(mockPosition);
            
            // Nutzer-Info anpassen
            document.getElementById("location-display").innerHTML = 
                `Lat: ${parseFloat(geoData.latitude).toFixed(4)}°, Lng: ${parseFloat(geoData.longitude).toFixed(4)}° (via IP: ${geoData.city})`;
            return; // Beendet die Fehlerbehandlung, manuelles Menü bleibt versteckt
        }
    } catch (e) {
        console.warn("Externe IP-Ortung fehlgeschlagen", e);
    }

    // Stufe 3: Manuelles Fallback-Menü einblenden
    document.getElementById("location-display").innerHTML = "<span class='alert'>Standort unbekannt. Bitte manuell eingeben:</span>";
    document.getElementById("anchor-type").innerText = "Warte auf Input...";
    document.getElementById("manual-location").style.display = "block";
}

// Stufe 3 Ausführung: Verarbeitet die Button-Klicks des manuellen Menüs
function setManualLocation() {
    const lat = parseFloat(document.getElementById("manual-lat").value);
    const lng = parseFloat(document.getElementById("manual-lng").value);

    // Sicherheits-Prüfung: Limitierung auf physische Erd-Koordinaten
    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        alert("Fehler: Bitte gültige Dezimal-Koordinaten eingeben!\nBreitengrad: -90 bis 90\nLängengrad: -180 bis 180");
        return;
    }

    // Baut ein künstliches Location-Objekt für die init-Funktion
    const mockPosition = {
        coords: {
            latitude: lat,
            longitude: lng
        }
    };
    
    initDecTime(mockPosition);
    // UI-Zusatz, damit der Nutzer sieht, dass die manuelle Eingabe aktiv ist
    document.getElementById("location-display").innerHTML += " <span style='color: #ffaa00;'>(Manuell)</span>";
}

// Visualisierungs-Modul: Zeichnet die Sonnenkurve und den aktuellen Stand
function drawSunPath() {
    if (globalLat === null || globalLng === null) return;
    
    const canvas = document.getElementById("sun-graph");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Canvas leeren für das nächste Frame
    ctx.clearRect(0, 0, width, height);

    // 1. Horizontlinie zeichnen (Y-Achse ist im Canvas umgekehrt: 0 ist oben)
    const horizonY = height * 0.7;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(width, horizonY);
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    ctx.stroke();

    // 2. Sonnen-Pfad für den heutigen Tag berechnen
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    ctx.beginPath();
    ctx.strokeStyle = "#555"; // Graue Kurve
    ctx.lineWidth = 2;

    let currentSunX = 0;
    let currentSunY = 0;

    // Wir gehen jeden X-Pixel durch und berechnen die Sonnenhöhe
    for (let x = 0; x <= width; x++) {
        // Welcher Uhrzeit entspricht dieser Pixel?
        const timeForPixel = new Date(startOfDay.getTime() + (x / width) * 86400000);
        
        // SunCalc gibt die Höhe (Altitude) in Radianten zurück
        const pos = SunCalc.getPosition(timeForPixel, globalLat, globalLng);
        
        // Skalierung: 90 Grad (Zenit = Math.PI/2) entspricht dem Abstand vom Horizont zum oberen Rand
        const scale = horizonY / (Math.PI / 2);
        const y = horizonY - (pos.altitude * scale);

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        // Prüfen, ob dieser Pixel ungefähr der Jetzt-Zeit entspricht
        if (Math.abs(timeForPixel.getTime() - now.getTime()) < (86400000 / width / 2)) {
            currentSunX = x;
            currentSunY = y;
        }
    }
    ctx.stroke();

    // 3. Die aktuelle Sonne zeichnen
    ctx.beginPath();
    ctx.arc(currentSunX, currentSunY, 5, 0, 2 * Math.PI);
    ctx.fillStyle = currentSunY > horizonY ? "#444" : "#ffcc00"; // Gelb am Tag, Grau in der Nacht
    ctx.fill();
    
    // Kleiner Leuchteffekt, wenn die Sonne über dem Horizont ist
    if (currentSunY <= horizonY) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#ffaa00";
        ctx.arc(currentSunX, currentSunY, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0; // Zurücksetzen
    }
}

// System-Start: Stufe 1 (HTML5 Geolokalisierung) initialisieren
navigator.geolocation.getCurrentPosition(initDecTime, handleGpsError);
