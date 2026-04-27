// Globale System-Variablen
let anchorTimeMs = null;
let clockInterval = null;

// Hauptfunktion: Initialisiert die Uhr basierend auf bereitgestellten Koordinaten
function initDecTime(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    
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

    // Mathematische Umrechnung
    const totalDecSeconds = Math.floor(diffMs / 864);
    const decHours = Math.floor(totalDecSeconds / 10000);
    const remainderAfterHours = totalDecSeconds % 10000;
    const decMinutes = Math.floor(remainderAfterHours / 100);
    const decSeconds = remainderAfterHours % 100;

    // Führende Nullen hinzufügen
    const format = (num) => num.toString().padStart(2, '0');
    
    document.getElementById("dectime-display").innerText = 
        `${decHours}.${format(decMinutes)}.${format(decSeconds)}`;
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

// System-Start: Stufe 1 (HTML5 Geolokalisierung) initialisieren
navigator.geolocation.getCurrentPosition(initDecTime, handleGpsError);
