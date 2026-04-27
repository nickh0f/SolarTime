// Dateipfad: functions/geo.js
export async function onRequest(context) {
    const { request } = context;
    
    // Cloudflare injiziert automatisch Geodaten in das request.cf Objekt
    const geoData = {
        lat: request.cf.latitude || null,
        lng: request.cf.longitude || null,
        city: request.cf.city || "Unbekannt"
    };

    return new Response(JSON.stringify(geoData), {
        headers: { "content-type": "application/json" }
    });
}