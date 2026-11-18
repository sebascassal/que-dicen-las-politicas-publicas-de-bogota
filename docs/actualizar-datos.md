# Actualizar los datos a un corte nuevo

Los planes de acción cambian: se publican versiones nuevas, se adoptan políticas y otras cierran. Esta guía cubre el paso de un corte a otro. Si el cambio es solo de código, basta con `python3 scripts/construir.py` y `python3 pruebas/verificar.py`.

Todo el procedimiento toma unas horas. La parte delicada es leer bien los Excel.

## 1. Descargar los planes

1. Abre la página de la SDP: <https://www.sdp.gov.co/gestion-socioeconomica/conpes-dc/politicas-publicas>.
2. Anota cuántos planes de acción se publican y la versión de cada archivo, que suele ir en el nombre (por ejemplo `pa_habitat_v5-26_dp.xlsx`).
3. Descarga los archivos desde el navegador. Están en `/sites/default/files/decretos-conpes/`. El sitio suele bloquear la lectura automática de sus páginas, pero no la descarga de los archivos desde el navegador.

## 2. Leer cada Excel

Lecciones de los cortes anteriores:

- **La hoja.** La útil se llama «Plan de acción». Las de «Instructivo», «Versiones» y las fichas técnicas se ignoran.
- **El encabezado.**
  - El de producto es «Producto esperado».
  - **La fila siguiente es un subencabezado: hay que saltarla.**
  - Si no se salta, todos los valores de vigencia se corren una fila. Ese error ya ocurrió.
- **La vigencia.**
  - Está en la columna inmediatamente posterior a «Nombre del indicador de producto».
  - Comprueba siempre que haya tantos valores de vigencia como productos y que el primero no sea un encabezado.
- **Celdas combinadas.** El objetivo específico y el resultado vienen en celdas combinadas: arrástralos hacia abajo para que cada producto tenga los suyos.
- **Formatos antiguos.** Algunos planes viejos no traen columna de vigencia o no traen columna de productos. Regístralos en `excluidos` con su motivo en vez de forzarlos.
- **Números.** Lee las metas como texto y no conviertas los números: el CSV guarda el valor tal como viene del archivo, y el visor lo presenta.
- **Textos completos.** No recortes los textos. El corte anterior llegó con los indicadores recortados a 250 caracteres y los resultados y objetivos a 240 (ver [datos](datos.md#calidad-de-los-datos-lo-que-conviene-saber)).
- **Celdas de texto.** Si el lector de Excel deja `_x000D_` (retorno de carro escapado), conviértelo en espacio al extraer.

## 3. Escribir los archivos de `datos/fuente/`

Respeta el formato de [datos](datos.md): las mismas columnas y en el mismo orden, UTF-8 con BOM y saltos de línea CRLF.

- **`productos_vigentes.csv`.** Solo las filas «Vigente», con `id` secuencial desde P0000 en el orden de los planes.
- **`politicas_vigentes.csv`.** Una fila por política con productos vigentes. `productos_vigentes` debe coincidir con el CSV de productos.
- **`verificacion_fuente.json`.** Cambia:
  - `fecha_verificacion`: la fecha de corte, que el visor escribe en todas partes;
  - los conteos;
  - `excluidos`, `otras_exclusiones` y `por_politica`.

  - `claves` de cada plan excluido: las palabras y expresiones de su tema que activan el aviso al buscar.

  Precisa además cómo se contaron los productos de los planes excluidos (ver la nota en [datos](datos.md#fuente)).
- **`datos/catalogos/entidades.csv`.** Agrega las formas nuevas de escribir una entidad, con su nombre normalizado. La construcción falla si falta alguna.
- **`datos/datapackage.json`.** Actualiza la descripción y la fecha. La versión, los tamaños y las huellas se escriben solos con `python3 scripts/construir.py --huellas` (paso 7).

## 4. Entrenar el modelo

```bash
pip install -r scripts/requirements.txt
python3 scripts/entrenar_modelo.py --salida /tmp/modelo_nuevo.json --comparar datos/modelo/modelo_semantico.json
```

- **El modelo nuevo** usa los productos de `productos_vigentes.csv` y toma su versión de la fecha de corte.
- **La comparación** con el modelo anterior solo tiene sentido si los productos son los mismos. En un corte nuevo no lo serán: omite `--comparar`.

Revisa a mano algunas búsquedas conocidas antes de adoptarlo: vivienda, empleo, mujer, ambiente, movilidad. Luego cópialo:

```bash
cp /tmp/modelo_nuevo.json datos/modelo/modelo_semantico.json
```

## 5. Revisar las consultas de control

```bash
node pruebas/generar_consultas_control.js /tmp/consultas.json
```

- **Para cada consulta,** el script propone el producto más relacionado y las vecinas que da el modelo nuevo.
- **Revisa la propuesta.** El producto debe ser pertinente y las vecinas, razonables. Si una consulta deja de tener sentido, cámbiala: el script acepta consultas como argumentos.
- **Adóptala** copiándola a `datos/pruebas/consultas_control.json`. Las consultas de control fijan el comportamiento revisado por una persona; no son una medida de calidad automática.

## 6. Actualizar los textos que no salen de los datos

- **Cifras de referencia.** `node pruebas/cifras_de_referencia.js` recalcula la similitud mediana al azar, el porcentaje de pares desde 0,18, el producto más parecido de otra política y la calibración de las bandas, y dice dónde faltan. Corrígelas en `src/app/15-fuente-y-metodo.js` y en `docs/metodologia.md`.
- **Exclusiones.** La lista de exclusiones de «Fuente y método» sale de `verificacion_fuente.json`. El texto que la acompaña está en `src/app/15-fuente-y-metodo.js`.
- **Bandas.** Si la distribución cambió mucho, revisa los umbrales de las bandas (`BAND_T` en `src/app/02-datos-y-motor.js`) y la sección de bandas de la metodología.
- **Documentación del corte.**
  - `README.md` (cifras de la portada);
  - `docs/datos.md` (tamaños, celdas vacías, notas de calidad);
  - `docs/metodologia.md` (ejemplos con cifras);
  - `CHANGELOG.md` y `CITATION.cff` (versión y fecha).

## 7. Construir y verificar

```bash
python3 scripts/construir.py --huellas   # tamaños, huellas y versión en datos/datapackage.json
python3 scripts/construir.py
python3 pruebas/verificar.py
```

Corre `--huellas` de último, cuando los archivos de `datos/` y la versión de `CITATION.cff` ya no vayan a cambiar. Si se te olvida, la construcción falla y te lo recuerda.

Si la verificación en navegador marca cambios de diseño esperados, actualiza `pruebas/referencia_medidas.json` con las medidas nuevas y explica el motivo en el cambio. Un cambio de cifras o de nombres largos de políticas puede mover la cabecera unos píxeles.

## Lista de comprobación

- [ ] Archivos descargados y versiones anotadas
- [ ] Vigencia leída sin el subencabezado; conteos de vigencia iguales a los de productos
- [ ] CSV con BOM, CRLF y las mismas columnas
- [ ] `verificacion_fuente.json` con la fecha y los conteos nuevos
- [ ] Modelo entrenado y revisado a mano
- [ ] Consultas de control revisadas por una persona
- [ ] Cifras de referencia y textos actualizados
- [ ] Sin datos personales nuevos en los textos (correos, teléfonos, nombres de personas)
- [ ] `python3 scripts/construir.py --huellas` después del último cambio en `datos/`
- [ ] `python3 pruebas/verificar.py` termina con «VERIFICACIÓN COMPLETA: todo pasa»
- [ ] `CHANGELOG.md` y `CITATION.cff` con la versión nueva
