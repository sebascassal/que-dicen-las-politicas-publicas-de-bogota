# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

## [5.2.1] — 2026-11-15

Segunda revisión técnica antes de compartir el repositorio, en seis frentes ([informe](docs/revision-comite.md#segunda-revisión-versión-521)). El modelo semántico, los datos de la fuente y la distribución en un solo archivo no cambian.

### Seguridad

- **Publicación en GitHub Pages.** El flujo `publicar.yml` se disparaba con cualquier verificación exitosa cuya rama se llamara `main`, también la de una solicitud de cambio enviada desde una bifurcación, y construía y publicaba el código de esa bifurcación con permiso de escritura en Pages. Ahora solo publica cambios que ya están en la rama `main` de este repositorio.
- **Copiar tabla.** Una celda que empiece como una fórmula (`=`, `+`, `@` o un guion que no es un número) se copia con un apóstrofo delante, para que la hoja de cálculo la lea como texto. Ningún texto del corte actual está en ese caso.
- **Enlaces externos.** Los enlaces a los planes y documentos ya no envían la dirección de la página de origen (`no-referrer`).
- **Construcción.** Las piezas se insertan en la plantilla en una sola pasada: un texto de los datos o del código que contenga una marca de inserción ya no puede ser reemplazado.

### Corregido

- **Datos personales.** Dos productos (P0461 y P0462) mostraban el correo institucional de una persona junto al nombre de la dependencia, como viene en el plan. El visor ya no muestra correos. El CSV de la fuente se conserva como se extrajo.
- **Accesibilidad.**
  - **Nombre accesible (WCAG 2.5.3).** En «Políticas en la figura» y en «Palabras vecinas», el nombre que oye un lector de pantalla no empezaba por el texto visible del botón, y el control por voz no los encontraba. Ahora el nombre es el contenido del botón, con el nivel de banda como texto oculto a la vista. axe-core pasa de 34 incumplimientos a ninguno.
  - **Tarjeta elegida.** Al quitar el foco de una política, la tarjeta que estaba elegida seguía marcada como actual para el lector de pantalla.
- **Trato.** «Fuente y método» mezclaba «usted» y «tú».
- **Documentación.** La arquitectura citaba un presupuesto de 2,9 MB (es 3,1 MB) y decía que la prueba de WebKit usa Playwright (usa WebKitGTK del sistema). La guía de actualización decía que la lista de exclusiones está en el código (sale de los datos).

### Añadido

- **Huellas de los datos.** `datos/datapackage.json` trae el tamaño y la huella SHA-256 de cada archivo. La construcción falla si no corresponden o si la versión difiere de `CITATION.cff`, y `python3 scripts/construir.py --huellas` las actualiza.
- **Variante de ensayo con política de seguridad de contenido:** `python3 scripts/construir.py --csp --salida ruta.html`. Pasa todos los recorridos en Chrome. Falta probarla en Safari antes de adoptarla.
- **`SECURITY.md` y `CODE_OF_CONDUCT.md`:** cómo avisar de un problema de seguridad o de un dato personal, y reglas de convivencia.
- **Pruebas nuevas:** sin correos en los textos que muestra el visor; nombres accesibles del índice de políticas y de las palabras vecinas.
- **Notas de calidad de los datos:** correos de personas y códigos de producto repetidos o vacíos (`docs/datos.md`).

## [5.2.0] — 2026-11-13

Primera versión pública como repositorio. La versión pasó por una revisión técnica en cuatro frentes, hecha con asistencia de inteligencia artificial y sin participación de la Secretaría Distrital de Planeación ([informe](docs/revision-comite.md)). El modelo semántico no cambia.

### Corregido

- **Menciones literales.**
  - El índice de textos perdía las últimas palabras de 1.243 textos con varios signos de puntuación.
  - Diez resultados con tildes descompuestas no se leían bien.
  - «interés» e «intereses» se buscaban por raíces distintas.
  - Ahora toda palabra de cada producto está en el índice, y una prueba lo comprueba.
- **Singular y plural.** Algunos quedaron como términos distintos del modelo («adolescente» y «adolescent», de «adolescentes») y daban listas casi sin coincidencias. Ahora una palabra reúne todos los términos que comparten raíz.
- **Lo que menciona lo buscado siempre está en la lista,** como en Ctrl+F: con una palabra, todos los productos que la mencionan; con varias, los que las mencionan todas. Antes, con «salud» faltaban 39 de los 220 productos que la nombran.
- **Palabras demasiado frecuentes.** Buscar «personas», «estrategia» o «aumento» proponía otra palabra («personal», «estratégica», «2aumento»). Ahora el visor explica que se descartan porque aparecen en más del 20 % de los productos.
- **Residuos de la extracción.** El término «x000d» (retorno de carro escapado de Excel) salía como vecina de «abuso». Ahora los textos se limpian al construir (forma NFC, sin escapes ni caracteres invisibles), y los términos residuales no se muestran.
- **Textos recortados.** Los textos muy largos llegaron recortados en la extracción (indicadores a 250 caracteres, resultados y objetivos a 240). Ahora se marcan con «…», y se corrigieron las frases que los presentaban como completos.
- **Entidades.** Las 88 formas de escritura se agrupan en 52 entidades normalizadas, por ejemplo la Secretaría de Educación, que aparecía con dos nombres. Las que el plan no indica aparecen como «Sin entidad en el plan».
- **Cifras de «Fuente y método».**
  - La similitud de referencia decía 0,39; con el modelo del visor es 0,56. Se añadió la línea base de 0,03 entre productos al azar.
  - El ejemplo de banda «muy alta» sumaba 4,95, que es nivel alto.
  - Se aclara la procedencia de los pesos del modelo.
- **Metas.**
  - Se muestran sin residuos de cálculo (`1.0000000000000004` → `1`).
  - En los indicadores de porcentaje, la proporción lleva su equivalente: «0,65 (proporción: 65 %)».
- **Dirección de la página.** Una dirección con más de tres unidades rompía la nube, y una expresión con guion no sobrevivía al enlace.
- **Índice y búsqueda activa.** Si la búsqueda empezaba antes de que terminara el índice, quedaba sin menciones literales.
- **Accesibilidad.**
  - **Teclado:** las flechas de la nube ya no se detienen en la segunda pulsación, y el producto elegido se anuncia.
  - **Foco:** se conserva al reconstruir la leyenda, el índice, las facetas y los filtros, y es visible sobre fondos negros.
  - **Contraste:** el gris de los textos secundarios cumple 4,5:1.
  - **Animación:** se detiene a los 5 s sin interacción (WCAG 2.2.2).
  - **Tarjetas:** salen del orden de tabulación.
  - **Tamaños:** los botones de las tarjetas miden al menos 32 px de alto en pantallas táctiles.
  - **Valores:** ya no aparece «-0,00».

### Añadido

- **Palabras vecinas en texto.** Debajo de la nube hay una lista de botones para leerlas con lector de pantalla y sumarlas con el teclado. El nivel de banda de cada política está en su nombre accesible.
- **Avisos de cobertura.** Si una búsqueda toca el tema de una política que no está en el visor (familias, vejez, habitabilidad en calle, adultez o servicio a la ciudadanía), el visor lo avisa.
- **Uso responsable y citación.**
  - «Fuente y método» abre con un recuadro «Antes de citar estos resultados» y con la forma de citar.
  - «Copiar tabla» agrega una primera fila con la búsqueda, los filtros, el corte, la versión y el aviso.
  - La versión aparece en el pie de página.
  - El perfil de cada política enlaza su plan de acción y su documento.
- **Repositorio documentado:** metodología, diccionario de datos, arquitectura, guía para actualizar a un corte nuevo, licencias, cita, guía de contribución y plantillas de avisos.
- **Datos para máquinas:**
  - catálogo de entidades (`datos/catalogos/entidades.csv`);
  - `datos/datapackage.json` (Frictionless Data Package, validado);
  - `CITATION.cff` con las dos licencias y la referencia a la fuente.
- **Construcción reproducible** con `scripts/construir.py`. Valida los datos y que el modelo corresponda a los textos, escribe en la página la fecha de corte, los totales y la versión, y comprueba sus marcas de inserción. El resultado es el mismo archivo byte a byte.
- **Entrenamiento del modelo** con `scripts/entrenar_modelo.py`, con descomposición exacta y determinista.
  - Reconstruye dos parámetros del procedimiento original que no estaban documentados: la frecuencia sublineal y el descarte de palabras en más del 20 % de los productos.
  - El vocabulario coincide término a término con el publicado, y la coincidencia de resultados es del 88 %.
- **Pruebas nuevas:**
  - índice completo;
  - singular y plural;
  - textos limpios;
  - residuos ocultos;
  - formas escritas;
  - cifras de referencia al día (`pruebas/cifras_de_referencia.js`);
  - propuesta de consultas de control (`pruebas/generar_consultas_control.js`);
  - en Chrome: teclado, foco, vecinas, avisos y direcciones malformadas.
- **Integración continua** en GitHub Actions:
  - versiones mínimas y actuales;
  - recorridos en Chrome que bloquean;
  - medidas en píxeles que solo informan;
  - publicación en GitHub Pages después de verificar;
  - Dependabot.

### Cambiado

- **Lectura de las bandas.**
  - El rótulo pasa a «intensidad de la articulación temática».
  - Se aclara que crece con el tamaño del plan y que no mide coordinación entre entidades ni entre políticas.
  - La ficha de cada política muestra «n de N productos (x %)».
- **Rótulos.**
  - «Políticas más afines» pasa a «Políticas con textos más parecidos», con la referencia de 0,12 de mediana.
  - «Sus palabras propias» pasa a «Palabras frecuentes en su plan».
  - «Sector» pasa a «Sector líder».
  - «47 políticas distritales» pasa a «47 políticas incluidas».
  - La comprobación del modelo se presenta como «Comprobación de funcionamiento», que no mide la calidad.
- **Fuente y método.** El número de planes leídos y las exclusiones salen de los datos.

## [5.1.0] — noviembre de 2026

### Cambiado

- **Bandas por intensidad de la articulación.**
  - Las líneas entre palabras y políticas pasan a ser bandas de cinco niveles fijos, de muy baja a muy alta.
  - El grosor y el color van en una rampa de un solo tono, de rosa a rojo oscuro.
  - Tienen leyenda propia, ficha con el nivel por palabra y borde al resaltar una política.

## [5.0.0] — noviembre de 2026

### Añadido

- **Unidades de significado.** Expresiones como «habitante de calle» se leen como una sola unidad, con sugerencias al escribir y un diccionario de 700 expresiones del corpus.
- **Menciones literales** resaltadas en el texto, con filtro propio.
- **Productos parecidos** a uno de referencia, y **perfil de cada política**: palabras propias y políticas más afines.
- **Filtros** por entidad, enfoque, fuerza de la relación y productos que conectan palabras. Además, orden de la lista y «Copiar tabla».
- **Navegación.** Recorrido de búsquedas, búsqueda al azar, atajo «/» y búsqueda en la dirección de la página para compartir.

## [4.x] — noviembre de 2026

- **Primeras versiones del visor:**
  - nube de relaciones entre palabras y políticas;
  - lista de productos relacionados;
  - sección «Fuente y método» con validación del modelo en el navegador;
  - diseño adaptable a teléfonos, incluido Safari en iPhone.
