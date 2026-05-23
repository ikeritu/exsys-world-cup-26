window.APP_CONFIG = {
  APP_NAME: "ExSys World Cup 26",

  // 1) Pega aquí la URL del despliegue de Google Apps Script.
  // Ejemplo: "https://script.google.com/macros/s/AKfycbx.../exec"
  API_URL: "https://script.google.com/macros/s/AKfycbzQgNBsGVUx--2x-Kb1GIUEpqhmQVbKL22C7cOygBsEcEPtVs9B188lUnVbmPxwN0b8lw/exec", // Se rellena al crear el despliegue de Google Apps Script (/exec). Sin esto, la web funciona en demo/local pero no guarda en Sheets.

  // 2) Clave suave para que la web no se vea si no conoces el parámetro.
  // URL final ejemplo:
  // https://tuusuario.github.io/exsys-world-cup-26/?clave=exsys26
  ACCESS_KEY: "exsys26",

  // 3) Límite de edición de predicciones.
  EDIT_DEADLINE_ISO: "2026-06-10T23:59:59+02:00",

  // 4) Hash de la clave admin SOLO para desbloqueo visual local.
  // La clave real se valida en Google Apps Script con Script Properties.
  ADMIN_KEY_HASH: "cf2661b79280502b34a8b9d1e31a610b69e6f3ea292e08d0d6140d7ce7281efd"
};
