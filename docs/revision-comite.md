# Revisión técnica de las versiones 5.2.0 y 5.2.1

Antes de publicar el repositorio hubo dos revisiones técnicas, ambas hechas con asistencia de inteligencia artificial. **No son un aval institucional**, y la Secretaría Distrital de Planeación no participó.

- **Primera revisión (versión 5.2.0):** cuatro frentes. Es la que sigue.
- **[Segunda revisión (versión 5.2.1)](#segunda-revisión-versión-521):** seis frentes, sobre el repositorio ya corregido.

Las [decisiones pendientes del autor](#decisiones-pendientes-del-autor), al final, reúnen las de ambas.

## Cómo se hizo la primera revisión

- **Quiénes revisaron.** Cuatro revisores especializados, hechos con asistencia de inteligencia artificial: ingeniería de sistemas, ciencia de datos y procesamiento de lenguaje, análisis de políticas públicas, y accesibilidad con datos abiertos.
- **Método.** Cada uno revisó por separado una copia del repositorio. Ejecutó el código y el visor (Node, Python, Chrome con Playwright, axe-core) y entregó hallazgos con severidad, evidencia y recomendación.
- **Verificación.** Cada hallazgo se verificó antes de corregirlo. Las correcciones pasaron por `python3 pruebas/verificar.py` y por la prueba de WebKit.

**Resultado general.** El código no tiene sumideros de HTML ni peticiones externas, la construcción es determinista y Python y JavaScript leen los textos igual. No hubo hallazgos críticos.

Estados: **Corregido**; **Documentado** (se explica en la documentación, sin cambio de código); **Pendiente** (requiere una decisión del autor o insumos que no están en el repositorio).

## Antes del comité: lo que se encontró al documentar

Al preparar la documentación se verificó cada cifra contra el código. Aparecieron siete fallas, todas corregidas:

| Hallazgo | Estado |
|---|---|
| El índice de menciones literales perdía las últimas palabras de 1.243 textos con puntuación (búfer corto) | Corregido |
| «Fuente y método» citaba 0,39 como similitud de referencia; con el modelo del visor es 0,56 | Corregido |
| El ejemplo de banda «muy alta» (15 × 0,33 = 4,95) era nivel alto | Corregido |
| Las metas mostraban residuos de cálculo (`1.0000000000000004`) | Corregido |
| «personas», «estrategia» y «aumento» se corregían a otra palabra («personal», «estratégica», «2aumento») | Corregido |
| La nube mostraba formas internas sin tildes o recortadas («genero», «diferent») | Corregido |
| Dos parámetros del entrenamiento original no estaban documentados (frecuencia sublineal y descarte de palabras en más del 20 % de los productos) | Corregido: la reproducción sube de 73 % a 88 % |

## Ingeniería de sistemas

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| SIS-01 | Media | Una dirección con más de tres unidades rompía la nube; se aceptaban referencias repetidas | Corregido, con prueba en Chrome |
| SIS-02 | Media | La construcción no comprobaba que insertó el código y los datos | Corregido: cada marca debe estar una vez |
| SIS-03 | Media | Las pruebas en navegador no bloqueaban la integración continua; versiones sin fijar; publicación sin verificar | Corregido. Las acciones se fijan por versión mayor y Dependabot las mantiene al día; no se fijan por SHA |
| SIS-04 | Baja | Si se buscaba antes de que terminara el índice, la búsqueda quedaba sin menciones literales | Corregido |
| SIS-05 | Baja | Textos en NFD y raíz de «intereses» mal calculada: menciones perdidas | Corregido, con prueba |
| SIS-06 | Baja | Las expresiones con guion no sobrevivían al enlace | Corregido |
| SIS-07 | Baja | La fecha aceptaba el mes 00; poco margen de peso; versiones del entrenamiento sin fijar | Corregido. El presupuesto pasa a 3,1 MB, las versiones quedan fijas y se registra la huella del modelo |
| SIS-08 | Baja | El JSON incrustado no escapaba «&lt;!--»; no hay política de seguridad de contenido (CSP) | El escape está corregido. La CSP queda **pendiente**: hay que probar hashes de los scripts en Chrome y Safari |

## Ciencia de datos y lenguaje

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| DAT-01 | Alta | Singular y plural terminados en -e quedaban como términos distintos y daban listas casi disjuntas | Corregido sin reentrenar: la palabra reúne los términos que comparten raíz |
| DAT-02 | Media | Una búsqueda de una palabra omitía productos que la mencionan (con «salud», 39 de 220); el ejemplo de Ctrl+F era engañoso | Corregido: la lista incluye las menciones literales; ejemplo corregido |
| DAT-03 | Media | Con dos o tres palabras, las bandas no seguían la definición documentada | Documentado: la banda suma los productos de la lista |
| DAT-04 | Media | Residuos de Excel en el modelo y la nube («x000d»), tildes descompuestas, espacios de ancho cero | Corregido en el visor: textos limpios y residuos ocultos. Sacarlos del modelo exige reentrenar (**pendiente**) |
| DAT-05 | Media | Siete consultas de control no bastan para medir calidad | Documentado con un protocolo de evaluación; pruebas automáticas añadidas. La evaluación queda **pendiente** |
| DAT-06 | Baja | Los umbrales absolutos dependen de k | Documentado |
| DAT-07 | Baja | Desajustes menores entre documentación y código (×0,92, decimales, reglas del perfil) | Documentado |

## Análisis de políticas públicas

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| POL-01 | Alta | «Intensidad de la articulación» sugiere coordinación real y crece con el tamaño del plan | Corregido en la redacción: «articulación temática», aviso de tamaño y «n de N (x %)». Normalizar por tamaño queda **pendiente** |
| POL-02 | Alta | Textos recortados (indicadores a 250, resultados y objetivos a 240) presentados como completos | Corregido en el visor (marca «…») y documentado. Volver a extraer y reentrenar queda **pendiente**: exige los Excel de la SDP |
| POL-03 | Alta | Entidades sin normalizar: cifras partidas por entidad | Corregido: catálogo de 52 entidades |
| POL-04 | Alta | Las exclusiones no se veían al consultar | Corregido: «47 políticas incluidas» y aviso al buscar temas de políticas excluidas. Quedan **pendientes** el desglose de no vigentes por política y el subtítulo «…de las políticas vigentes», que es parte del nombre |
| POL-05 | Media | Metas de porcentaje sin unidad | Corregido: «0,65 (proporción: 65 %)» |
| POL-06 | Media | «Políticas más afines» sin referencia | Corregido: «Políticas con textos más parecidos», con mediana de 0,12 y aviso. Un piso mínimo queda **pendiente** |
| POL-07 | Media | «Sector» es el sector líder de la política | Corregido |
| POL-08 | Media | No había cómo citar ni reutilizar resultados | Corregido: fila de contexto en la copia, versión visible, forma de citar y enlace al documento de la política. Las huellas de los Excel fuente y «Productos parecidos solo de otras políticas» quedan **pendientes** |
| POL-09 | Media | La guía de uso responsable no estaba en el visor | Corregido |
| POL-10 | Baja | Rótulos del perfil y de los enfoques | Corregido |
| POL-11 | Baja | Detalles institucionales (este informe, descripción de la página, nombres completos) | Corregido |

## Accesibilidad, experiencia de uso y datos abiertos

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| UXA-01 | Alta | Las flechas de la nube se detenían en la segunda pulsación | Corregido, con anuncio en región viva y prueba |
| UXA-02 | Alta | Las palabras vecinas no tenían equivalente en texto ni teclado | Corregido: lista de botones, y nivel de banda en el índice |
| UXA-03 | Alta | El foco se perdía al redibujar | Corregido en leyenda, índice, facetas, filtros, vecinas, zoom y botones de cerrar |
| UXA-04 | Alta | El foco no se veía sobre fondos negros | Corregido |
| UXA-05 | Media | Gris secundario con contraste de 4,38:1; banda «muy baja» con 2,6:1 | El gris está corregido (5:1). La banda clara se mantiene para conservar la gradiente pedida y queda **pendiente**; el nivel también se lee por grosor y texto |
| UXA-06 | Media | Animación de más de 5 s sin pausa | Corregido: se detiene a los 5 s |
| UXA-07 | Media | Tarjetas con exceso de paradas de tabulación; semántica | Corregido: tarjetas fuera del orden de tabulación, `aria-current`, `role="group"` y `<section>` |
| UXA-08 | Media | Una entidad con varios nombres | Corregido (igual que POL-03) |
| UXA-09 | Media | Metadatos FAIR incompletos | Corregido: `datapackage.json` validado, `CITATION.cff` con dos licencias y fuente, licencias alineadas. Quedan **pendientes** el identificador estable entre cortes y el DOI |
| UXA-10 | Baja | La ficha quedaba recortada con zoom al 200 % | Corregido: se acopla en pantallas bajas |
| UXA-11 | Baja | Objetivos de toque y letra pequeños en el teléfono | Los objetivos de toque están corregidos (32 px). El tamaño del aviso en la cabecera queda **pendiente**: cambia el diseño |
| UXA-12 | Baja | «-0,00», espacios sobrantes, año de la licencia de Montserrat, Excel con punto y coma | Corregido |

## Segunda revisión (versión 5.2.1)

**Cómo se hizo.** Un solo revisor, con asistencia de inteligencia artificial, recorrió el repositorio completo desde seis frentes: seguridad y cadena de suministro, privacidad y datos, accesibilidad, ingeniería del código, rendimiento, y documentación y preparación para publicar. No fueron seis revisores independientes.

**Qué se ejecutó.**
- La verificación completa (`pruebas/verificar.py`) antes y después de cada corrección: construcción, determinismo, modelo, unidades, cifras, recorridos y funciones en Chrome y medidas en ocho tamaños.
- axe-core (reglas WCAG 2.0 a 2.2, niveles A y AA, y buenas prácticas) en tres estados: escritorio, teléfono y «Fuente y método».
- ESLint sobre el motor y la aplicación ya unidos, y html-validate sobre la plantilla.
- El entrenamiento del modelo (`scripts/entrenar_modelo.py --comparar`).
- Una comparación, texto por texto, de cómo leen las palabras Python y JavaScript.
- `frictionless validate` sobre `datos/datapackage.json`.
- Una búsqueda de datos personales, de fórmulas y de códigos repetidos en los CSV.

**Resultado general.** Un hallazgo alto de seguridad en la publicación automática y uno alto de accesibilidad, ambos corregidos. Un dato personal en el visor, corregido. Lo demás son ajustes menores. El modelo, los datos de la fuente y la distribución en un solo archivo no cambian.

### Seguridad y cadena de suministro

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| SEG-01 | Alta | `publicar.yml` se disparaba con cualquier verificación exitosa cuya rama se llamara `main`. Una solicitud de cambio enviada desde una bifurcación con ese nombre de rama habría hecho que el flujo, que tiene permiso de escritura en Pages, ejecutara `construir.py` de la bifurcación y publicara su `dist/` | Corregido: solo publica si la verificación vino de un `push` a `main` de este repositorio |
| SEG-02 | Baja | «Copiar tabla» no protegía las celdas que una hoja de cálculo lee como fórmula (`=`, `+`, `@`, guion) | Corregido: van con apóstrofo delante. Ningún texto del corte actual está en ese caso |
| SEG-03 | Baja | Los enlaces externos enviaban la dirección de la página de origen | Corregido: `no-referrer` en la página y en cada enlace |
| SEG-04 | Baja | Las piezas se insertaban en la plantilla en cinco pasadas: una marca de inserción dentro del código o de los datos habría sido reemplazada | Corregido: una sola pasada |
| SEG-05 | Baja | Política de seguridad de contenido (era SIS-08) | Avanza: `construir.py --csp` genera una variante con huellas de los scripts y estilos, que pasa todos los recorridos en Chrome sin errores de consola. Adoptarla queda **pendiente** de probarla en Safari |
| SEG-06 | — | Acciones de GitHub fijadas por versión mayor | Sin cambio (decisión de SIS-03). Se comprobó que las siete versiones usadas existen |

### Privacidad y datos

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| PRI-01 | Media | Dos productos (P0461 y P0462) mostraban el correo institucional de una persona en la dependencia, como viene en el plan publicado | Corregido en el visor, con prueba: no se muestran correos. El CSV de la fuente lo conserva; quitarlo de ahí queda **pendiente** |
| DAT-08 | Media | `datapackage.json` no traía tamaño ni huella de los archivos: no había cómo comprobar que una copia de los datos es la publicada | Corregido: tamaño y SHA-256 de cada archivo; la construcción falla si no corresponden. Validado con Frictionless |
| DAT-09 | Baja | El identificador estable propuesto (instrumento + código) no es único: nueve productos no traen código y dos del Decreto 600 de 2023 comparten el 3.1 | Documentado en `docs/datos.md`. Afecta la decisión pendiente 6 |
| DAT-10 | — | Python y JavaScript leen las palabras igual | Comprobado en los 8.292 textos (nombre, indicador y resultado de cada producto): cero diferencias en palabras y en secuencias |
| DAT-11 | — | El modelo reentrenado coincide con el publicado | Reproducido: 0,88 en los 10 primeros productos, 0,955 de correlación y 0,90 en las 10 primeras vecinas |

### Accesibilidad

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| ACC-01 | Alta | En «Políticas en la figura», el nombre accesible de cada botón no contenía su texto visible (WCAG 2.5.3, nivel A): el control por voz no los encuentra por lo que se lee en pantalla. axe-core lo marcó en 34 botones en escritorio y 22 en teléfono. Las «Palabras vecinas» tenían el mismo patrón | Corregido, con prueba: el nombre es el contenido del botón, con el detalle oculto a la vista. axe-core: cero incumplimientos en los tres estados |
| ACC-02 | Baja | Al quitar el foco de una política, la tarjeta elegida conservaba `aria-current` | Corregido |
| ACC-03 | Media | El lienzo de la nube se anuncia como imagen (`role="img"`) y a la vez recibe teclado. axe-core no lo marca, pero un lector de pantalla puede no pasar las flechas a una imagen | **Pendiente:** probar con NVDA y VoiceOver. La lista de productos y las listas bajo la figura ya dan la misma información |
| ACC-04 | — | Contraste | axe-core no pudo decidir 168 textos sobre fondos compuestos. No se revisaron a mano en esta ronda; la banda «muy baja» sigue pendiente (UXA-05) |

### Ingeniería del código

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| ING-01 | Baja | `pruebas/verificar.py` tenía un `if True:` sobrante | Corregido |
| ING-02 | — | Análisis estático | ESLint sobre motor y aplicación: cero errores y cinco avisos de estilo (escapes de más y variables de `catch` sin usar). Sin cambio. html-validate sobre la plantilla: cero errores |
| ING-03 | — | Sumideros y red | Confirmado: sin `innerHTML`, `eval`, peticiones, cookies ni almacenamiento |

### Rendimiento

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| REN-01 | — | Peso y arranque | 2,86 MB (1,34 MB con gzip). En Node, en la máquina de la revisión: motor 23 ms, índice de textos 72 ms, diccionario 34 ms. Sin cambio: el peso es el costo conocido de ir en un solo archivo |

### Documentación y preparación para publicar

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| DOC-01 | Baja | La arquitectura citaba un presupuesto de 2,9 MB (es 3,1 MB) y decía que la prueba de WebKit usa Playwright (usa WebKitGTK); la guía de actualización ubicaba las exclusiones en el código (salen de los datos) | Corregido |
| DOC-02 | Baja | Faltaban `SECURITY.md` y `CODE_OF_CONDUCT.md`, que GitHub espera en un repositorio público | Corregido |
| DOC-03 | Baja | «Fuente y método» mezclaba «usted» y «tú» | Corregido |
| DOC-04 | Baja | `CITATION.cff` y `datapackage.json` no traen la dirección del repositorio, y el README deja `<usuario>` y `<repositorio>` sin llenar | **Pendiente:** se llenan cuando el repositorio exista |

### Lo que esta revisión no pudo comprobar

- **Safari.** `pruebas/webkit_iphone.py` no corrió: la máquina de la revisión no tenía WebKitGTK. Los cambios de la 5.2.1 en la página son de texto oculto y atributos, sin estilos nuevos, pero no se vieron en el motor de Safari.
- **Versiones mínimas.** Las pruebas corrieron con Python 3.13 y Node 22, no con Python 3.9 y Node 18.
- **GitHub Actions.** Los flujos se revisaron leyéndolos; no se han ejecutado, porque el repositorio todavía no existe.
- **Lectores de pantalla.** No se probó con ninguno.
- **Los Excel de la SDP.** No están en el repositorio: no se contrastó ningún texto contra su plan.

## Decisiones pendientes del autor

1. **Normalizar las bandas por el tamaño del plan.** Hoy la banda suma; podría ponderar por la proporción del plan. Cambia cómo se ve la nube.
2. **Adoptar el modelo reentrenado.** Es exacto y determinista, y coincide en 88 % con el publicado. Conviene hacerlo junto con la evaluación humana propuesta en la metodología y con nuevas consultas de control.
3. **Volver a extraer los textos completos** de los Excel de la SDP y reentrenar. Corrige los recortes y elimina del vocabulario los residuos de Excel.
4. **Piso mínimo** para «Políticas con textos más parecidos».
5. **Subtítulo de la herramienta** («…de las políticas vigentes»). Podría precisarse como «…de los productos vigentes».
6. **Identificador estable** entre cortes y **DOI** en Zenodo. Instrumento + código no sirve tal cual: hay nueve productos sin código y un código repetido (DAT-09).
7. **Diseño:** el contraste de la banda más clara y el tamaño del aviso en la cabecera del teléfono.
8. **Política de seguridad de contenido (CSP).** La variante de ensayo ya pasa en Chrome (`python3 scripts/construir.py --csp --salida /tmp/visor_csp.html`). Falta abrirla en Safari, en computador y en iPhone; si funciona, se puede dejar por defecto.
9. **Correo en el CSV de la fuente** (P0461 y P0462). El visor ya no lo muestra. Falta decidir si también se quita del CSV, que hoy es idéntico a la extracción.
10. **Probar la 5.2.1 en Safari y con un lector de pantalla** (NVDA o VoiceOver), en especial la nube con teclado (ACC-03).
11. **Al crear el repositorio en GitHub:**
    - poner su dirección en `CITATION.cff` (`repository-code`), en `datos/datapackage.json` (`homepage`) y en el README, y correr `python3 scripts/construir.py --huellas` si cambia la versión;
    - activar *Settings → Pages → Source: GitHub Actions* y los avisos privados de seguridad (*Settings → Security → Private vulnerability reporting*), que `SECURITY.md` da por activos;
    - proteger la rama `main` para que exija la verificación antes de fusionar.
