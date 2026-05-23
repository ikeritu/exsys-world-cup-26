# ExSys World Cup 26

Porra privada del Mundial 2026 para jugar con amigos, con fase de grupos, bracket de eliminatorias, premios individuales, 11 ideal, ranking y panel de administrador.

## Estado de esta versión

Versión **v20** preparada para revisión local antes de subir a GitHub Pages y conectar Google Sheets.

### Cambios principales v20

- Mensaje de guardado cambiado a: **“La Compañero ha hablado”**.
- Corregido el avance del bracket para que los ganadores de dieciseisavos pasen a octavos respetando los cruces oficiales:
  - W73 vs W75
  - W74 vs W77
  - W76 vs W78
  - W79 vs W80
  - W83 vs W84
  - W81 vs W82
  - W86 vs W88
  - W85 vs W87
- El avance posterior también usa referencias de partido (`from`) en lugar de asumir emparejamientos consecutivos.
- Las predicciones, comparativas, estadísticas sensibles, centro de mando e impacto en vivo quedan ocultos hasta el cierre oficial de edición. Antes del cierre solo se puede ver el estado de participantes.
- La asignación de mejores terceros usa una asignación global compatible sin repetir grupos tanto en jugador como en admin. La matriz FIFA completa de 495 combinaciones aún no está cargada; el proyecto queda preparado para añadirla en `THIRD_PLACE_ASSIGNMENT_TABLE`.
- README reorganizado y actualizado.

## Archivos principales

| Archivo | Uso |
|---|---|
| `index.html` | Web principal de la porra |
| `style.css` | Diseño visual y responsive |
| `app.js` | Lógica de usuario, grupos, bracket, premios, ranking y guardado |
| `admin.html` | Panel de administración |
| `admin.js` | Lógica del panel admin |
| `config.js` | Configuración de enlace privado y URL de Google Apps Script |
| `data/worldcup2026.js` | Grupos, partidos, cruces y metadatos del torneo |
| `google-apps-script/Code.gs` | Backend para Google Sheets |
| `assets/exsys-logo.png` | Logo de la porra |

## Probar en local

Abre la web principal con la clave privada en la URL:

```text
file:///C:/Users/ikeri/proyectos/exsys-world-cup-26/index.html?clave=exsys26
```

Panel admin:

```text
file:///C:/Users/ikeri/proyectos/exsys-world-cup-26/admin.html
```

La clave admin local es:

```text
XXXX
```

## Funcionamiento para jugadores

1. Entrar con el enlace privado.
2. Crear usuario con nombre visible y PIN libre.
3. Rellenar resultados de grupos.
4. Revisar clasificación automática.
5. Elegir ganadores en el bracket.
6. Completar premios individuales y 11 ideal.
7. Revisar la porra.
8. Guardar.
9. Las predicciones de otros, comparativas y estadísticas sensibles se revelan solo después del cierre oficial de edición.

## Funcionamiento admin

Desde `admin.html` se puede:

- Introducir resultados reales de partidos.
- Calcular dieciseisavos reales desde resultados de grupo.
- Introducir premios reales.
- Introducir 11 ideal real.
- Resetear PINs.
- Borrar usuarios.
- Exportar ranking e historial.

## Sistema de puntuación

### Fase de grupos

| Acierto | Puntos |
|---|---:|
| Resultado exacto | 4 |
| Ganador/empate correcto | 2 |
| 1º exacto de grupo | 5 |
| 2º exacto de grupo | 3 |
| 3º exacto de grupo | 1 |

### Eliminatorias

| Acierto | Puntos |
|---|---:|
| Equipo en dieciseisavos | 3 |
| Equipo en octavos | 5 |
| Equipo en cuartos | 7 |
| Equipo en semifinales | 10 |
| Finalista | 18 |
| Campeón | 25 |
| Tercer puesto | 12 |

### Premios individuales

| Premio | Puntos |
|---|---:|
| Bota de Oro | 10 / 6 / 3 |
| Balón de Oro | 10 / 6 / 3 |
| Guante de Oro | 8 / 5 / 2 |
| Mejor jugador joven | 8 / 5 / 2 |
| 11 ideal | 3 por jugador acertado |

## Conectar Google Sheets

1. Crea una hoja nueva en Google Sheets.
2. Ve a `Extensiones` > `Apps Script`.
3. Pega el contenido de `google-apps-script/Code.gs`.
4. Guarda el proyecto.
5. Ejecuta una vez la función `setupAdminPinOnce()`. Esta versión fija `ADMIN_PIN = 2226`. También puedes crear manualmente una propiedad de script llamada `ADMIN_PIN` con el valor `2226`.
6. Despliega como aplicación web.
7. Copia la URL de despliegue terminada en `/exec`.
8. Pega esa URL en `config.js`, en la propiedad `API_URL`.

Mientras `API_URL` esté vacío, la web funciona como maqueta local, pero no guardará datos reales en Google Sheets.

## Subir a GitHub Pages

1. Crea un repositorio nuevo en GitHub.
2. Sube todos los archivos de esta carpeta.
3. En `Settings` > `Pages`, activa GitHub Pages desde la rama principal.
4. Comparte el enlace con la clave:

```text
https://TU_USUARIO.github.io/TU_REPO/?clave=exsys26
```

## Notas técnicas importantes

- La web usa GitHub Pages como frontend estático.
- Google Apps Script actúa como backend para leer/escribir en Google Sheets.
- No se deben poner claves privadas reales en `config.js`.
- La clave admin no aparece en claro en el frontend; la validación real debe hacerse en Apps Script.
- La asignación de terceros usa un fallback compatible y común para frontend/admin. Para precisión FIFA 100%, falta cargar la tabla oficial completa de 495 combinaciones en `THIRD_PLACE_ASSIGNMENT_TABLE`.

## Pendiente antes de publicar

- Probar flujo completo en local.
- Crear Google Sheet y Apps Script.
- Pegar `API_URL` en `config.js`.
- Subir a GitHub Pages.
- Hacer una prueba real con 2 usuarios ficticios antes de compartirlo con todos.


## v17 - Funciones ExSys añadidas

- Copiar predicción para WhatsApp con formato de grupo.
- Justificante de predicción guardada con fecha, versión, código de registro y hash simple.
- Historial por jugador desde el panel admin.
- Cuenta atrás reforzada hasta cierre de bolilla.
- Vista pública de participantes con estado de predicción y pago.
- Revelado de predicciones tras cierre aunque el usuario no haya enviado la suya.
- Centro de mando ExSys con campeón más elegido, compañero mainstream, compañero del caos y morosos.
- Simulador simple de impacto en vivo por partido.
- Botón de autocompletar aleatorio: conservador, caos o compañero.
- Avatar de jugador.
- Control de bote y premios desde admin.

> Nota: el hash del justificante es una trazabilidad ligera para control interno de la porra, no una firma criptográfica legal.


## v20 - Bracket visual oficial

- Predicciones de amigos ocultas hasta el cierre oficial, aunque el jugador ya haya guardado su porra.
- Comparativa ExSys, Centro de mando, estadísticas globales sensibles e impacto en vivo también bloqueados hasta el cierre.
- La vista Participantes puede verse antes del cierre, pero solo muestra estado de predicción/pago/avatar, no contenido de la porra.
- Admin y jugador usan la misma lógica de asignación compatible de mejores terceros.
- `setupAdminPinOnce()` deja el PIN real en `2226` para evitar confusión con `CAMBIA_ESTE_PIN`.
- README actualizado a v20 y bracket visual alineado por IDs reales de partido.


## v20 - Bracket visual oficial

- El bracket ya no se renderiza por bloques consecutivos.
- La disposición visual usa `BRACKET_VISUAL_LAYOUT` basado en IDs reales de partido.
- Las líneas SVG se dibujan desde `slot.from`, por lo que cruces como `M73 + M75 -> M90` quedan visualmente sincronizados con el avance funcional.
- Se mantienen las notas sobre terceros: la app usa asignación compatible mientras no esté cargada la matriz completa oficial.


## Cambios v20

- La pestaña **Predicciones de los amigos** queda bloqueada hasta el cierre oficial, aunque el jugador ya haya guardado su propia porra.
- Se elimina la comparativa incrustada dentro de esa pestaña para evitar filtraciones antes del cierre.
- El texto de la pestaña se actualiza para dejar claro que no hay chuleta hasta que cierre la bolilla.


## v22
- Corregido el artefacto visual de las líneas del knockout en GitHub Pages desactivando el SVG de conexión que se pintaba fuera del cuadro.
- El bracket mantiene la estructura y avance oficial por IDs de partido; solo se retira el dibujo de líneas hasta implementar una versión SVG 100% encapsulada.


## v23
- Corrección definitiva del artefacto visual de líneas del bracket en GitHub Pages.
- Además del SVG, se desactivan globalmente los pseudo-elementos `::before` y `::after` heredados de versiones anteriores del knockout.
- El bracket mantiene el orden funcional oficial, pero sin líneas visuales hasta una futura versión encapsulada.


## v25
- Configurado `API_URL` con el despliegue real de Google Apps Script.
- Añadido cache-busting a `config.js`, `app.js`, `admin.js`, `worldcup2026.js` y `style.css` para evitar que GitHub Pages o el navegador carguen versiones antiguas.


## v26
- Mejorado el botón de Compañero aleatoria: ahora completa fase de grupos, eliminatorias, campeón, tercer puesto, premios y 11 ideal.
- Añadido cache-busting nuevo para evitar que GitHub Pages cargue `app.js` antiguo.


## v27
- Corregida de raíz la función de Compañero aleatoria completa.
- Ahora las eliminatorias se simulan por IDs oficiales de partido, no por render ni por clicks visuales.
- El botón se renombra como “Compañero aleatoria completa” para confirmar que el navegador carga la versión correcta.


## v28
- Corregido el botón “Volver a editar” del modal de revisión final, que quedaba blanco sobre fondo claro y no se veía.
- Añadido cache-busting nuevo para `style.css` y scripts.


## v29
- Corrección definitiva del botón “Volver a editar” en el modal de revisión.
- El botón ahora lleva clase propia y estilo inline para evitar conflictos o caché de CSS.
- Añadido cache-busting nuevo para forzar carga de `app.js` y `style.css`.


## v30
- Corregido el botón “Copiar mi predicción para WhatsApp”, que podía quedar invisible por estilos heredados.
- Se añade clase propia, estilo visible y cache-busting nuevo.


## v31
- Corregido error del panel admin: `escapeAttr is not defined`.
- Añadida función `escapeAttr()` en `admin.js` y cache-busting nuevo.
