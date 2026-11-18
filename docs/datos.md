# Datos

Todo lo que usa el visor está en `datos/`. Los archivos de texto van en UTF-8. Los CSV llevan marca de orden de bytes (BOM) y saltos de línea CRLF para que Excel los abra bien con tildes. El separador es la coma: en un Excel configurado para Colombia, que espera punto y coma, conviene abrirlos con *Datos › Desde texto/CSV*.

`datos/datapackage.json` describe todos los archivos en formato [Frictionless Data Package](https://specs.frictionlessdata.io/data-package/): columnas, tipos, licencia, fuente, tamaño en bytes y huella SHA-256 de cada archivo. Se puede validar con `frictionless validate datos/datapackage.json`. La construcción falla si un tamaño o una huella no corresponden al archivo; se actualizan con `python3 scripts/construir.py --huellas`.

Los CSV de `fuente/` son idénticos, byte a byte, a los de la extracción original. Toda limpieza se hace al construir el visor, sin tocarlos.

| Archivo | Qué es | Tamaño |
|---|---|---|
| `fuente/productos_vigentes.csv` | Los 2.764 productos vigentes, una fila por producto | 2,8 MB |
| `fuente/politicas_vigentes.csv` | Las 47 políticas con productos vigentes | 14 kB |
| `fuente/verificacion_fuente.json` | Registro de lo que se leyó en la fuente y de lo que quedó por fuera | 3 kB |
| `modelo/modelo_semantico.json` | El modelo semántico que usa el visor, ya calculado | 1,4 MB |
| `pruebas/consultas_control.json` | Siete consultas con su resultado esperado | 3 kB |
| `catalogos/entidades.csv` | Catálogo de entidades: cada forma de escritura con su nombre normalizado y su sigla | 8 kB |
| `datapackage.json` | Metadatos legibles por máquina de todo lo anterior | 8 kB |

## Fuente

Planes de acción de las políticas públicas distritales publicados por la Secretaría Distrital de Planeación (SDP) en *Gestión socioeconómica › CONPES D.C. › Políticas públicas*:
<https://www.sdp.gov.co/gestion-socioeconomica/conpes-dc/politicas-publicas>

Cada política publica su plan de acción en un archivo de Excel. La columna `plan_accion_url` trae el enlace exacto del archivo de cada producto.

**Verificación del 4 de noviembre de 2026** (`verificacion_fuente.json`):

| Concepto | Valor |
|---|---|
| Archivos publicados por la SDP ese día | 52 (coinciden con los que se leyeron) |
| Planes con columna de productos | 51 |
| Productos leídos | 3.851 |
| Productos marcados «No vigente» en el propio plan | 1.086 |
| Productos vigentes, el universo del visor | **2.764 de 47 políticas** |

**Quedaron por fuera:**
- **Los 1.086 productos marcados «No vigente»** en la columna de vigencia de su plan.
- **CONPES D.C. 18 (Familias), 19 (Envejecimiento y Vejez), 20 (Habitabilidad en Calle) y 21 (Adultez).** Sus planes cerraron con informe final y su formato antiguo no trae columna de vigencia.
- **CONPES D.C. 03 (Servicio a la Ciudadanía, 2014).** Su archivo no trae columna de productos, y la política fue sustituida por el CONPES D.C. 42 (2026), que sí está incluido.
- **Una fila sin texto de producto.**
- **La Política de Bogotá 24/7,** que sigue en formulación y no tiene plan de acción publicado.

> **Pendiente de precisar.** La verificación no desglosa los productos de los CONPES D.C. 18 a 21. Como 2.764 + 1.086 + 1 = 3.851, esos productos no están contados entre los leídos, o lo están entre los no vigentes. Conviene dejarlo explícito en el próximo corte.

## `productos_vigentes.csv`

Una fila por producto vigente, en el orden de los planes. Las filas están en el mismo orden que las del modelo (`doc_ids`), y `scripts/construir.py` lo comprueba.

### Identificación

| Columna | Contenido | Ejemplo |
|---|---|---|
| `id` | Identificador interno, secuencial en este corte (P0000 a P2763). **No es un código oficial** y puede cambiar en otro corte. Los enlaces del visor a un producto (`#q-P1742`) dependen de él. | P1742 |
| `instrumento` | Acto que adopta la política | CONPES D.C. 26 · Decreto 561 de 2022 |
| `politica` | Nombre de la política, como en el plan | Política Pública Distrital de Turismo «Bogotá Destino Turístico…» 2023-2033 |
| `sector` | Sector administrativo líder | Hábitat |

### Contenido del producto

| Columna | Contenido | Ejemplo |
|---|---|---|
| `codigo` | Código del producto en el plan (vacío en 9 filas) | 2.1.6 |
| `producto` | Nombre del producto esperado | Subsidios de mejoramiento progresivo de vivienda ejecutados. |
| `indicador` | Nombre del indicador de producto | Número de subsidios de mejoramiento progresivo de vivienda ejecutados. |
| `resultado` | Resultado al que aporta (en el Excel viene en celdas combinadas) | 1.1 Ahorros en los requisitos… |
| `objetivo` | Objetivo específico de la política (también en celdas combinadas) | 1. Diseñar e implementar… |

### Responsables, metas y fuentes

| Columna | Contenido | Ejemplo |
|---|---|---|
| `entidad` | Entidad responsable, como viene escrita en el plan: 88 formas de escritura que corresponden a 52 entidades. Vacía en 29 filas. El visor muestra el nombre normalizado de `catalogos/entidades.csv`. | Secretaría Distrital de Educación |
| `dependencia` | Dependencia responsable (vacía en 38 filas; recortada a 90 caracteres en la extracción) | Subsecretaria de Servicio a la Ciudadanía |
| `meta_final` | Meta final del producto, tal como está guardada en el archivo (vacía en 2 filas) | 756000 |
| `enfoque` | Enfoques, en texto libre (170 variantes; vacío en 116 filas y «-» en 3) | PoblacionalDiferencial |
| `vigencia` | Siempre «Vigente» en este archivo | Vigente |
| `plan_accion_url` | Enlace al Excel del plan de acción en sdp.gov.co | https://www.sdp.gov.co/sites/default/files/… |
| `documento_url` | Enlace al documento de la política (sdp.gov.co, alcaldiabogota.gov.co o sisjur.bogotajuridica.gov.co) | |

**Sobre `meta_final`:**
- El CSV conserva el valor guardado en el Excel, incluidos residuos de cálculo como `1.0000000000000004` o `0.99960000000000016`.
- El visor la muestra con coma decimal y sin esos residuos (`meta_legible` en `scripts/construir.py`): `1.0000000000000004` se ve como `1` y `0.99960000000000016` como `0,9996`.
- En 766 de los 773 indicadores que empiezan por «Porcentaje», la meta viene como proporción: 1 equivale a 100 %.

## `politicas_vigentes.csv`

| Columna | Contenido |
|---|---|
| `instrumento` | Acto que adopta la política (une con `productos_vigentes.csv`) |
| `politica` | Nombre completo |
| `sector` | Sector administrativo líder |
| `productos_vigentes` | Número de productos vigentes; `scripts/construir.py` comprueba que coincide con el CSV de productos |
| `plan_accion_url` | Enlace al Excel del plan de acción |
| `documento_url` | Enlace al documento de la política |

El visor agrupa los 13 sectores en seis familias de color (`FAMILIAS` en `scripts/construir.py`). Los nombres cortos de las políticas salen de una regla general, con algunas excepciones fijas (`NOMBRE_CORTO_FIJO`).

## `verificacion_fuente.json`

| Campo | Contenido |
|---|---|
| `fuente` | Página de la SDP donde se publican los planes |
| `fecha_verificacion` | Fecha de corte (AAAA-MM-DD). El visor la escribe en todos los lugares donde aparece el corte. |
| `archivos_publicados`, `archivos_coinciden_con_lo_leido` | Archivos publicados ese día, y si coinciden con los leídos |
| `planes_leidos`, `productos_leidos` | Planes con columna de productos, y productos leídos en ellos |
| `productos_no_vigentes`, `productos_vigentes` | Productos marcados «No vigente», y universo del visor |
| `politicas_con_productos_vigentes` | Número de políticas del visor |
| `excluidos` | Planes que no entran, con su motivo y `claves`: palabras y expresiones de su tema. Si una búsqueda las toca, el visor avisa que esa política no está. |
| `otras_exclusiones` | Lo que quedó por fuera y no es un plan publicado |
| `por_politica` | Pares [instrumento, productos vigentes] |

## `catalogos/entidades.csv`

Una fila por cada forma en que una entidad viene escrita en los planes: `entidad_en_el_plan`, `entidad` (nombre normalizado), `sigla` y `productos`. Por ejemplo, «Secretaría de Educación del Distrito» (185 productos) y «Secretaría Distrital de Educación» (54) son la misma entidad, la SED. La fila vacía agrupa los productos cuyo plan no indica entidad, que el visor muestra como «Sin entidad en el plan». `scripts/construir.py` falla si aparece una entidad que no está en el catálogo.

## `modelo_semantico.json`

| Campo | Contenido |
|---|---|
| `k` | Dimensiones del modelo (128) |
| `terms`, `df`, `idf` | Vocabulario (4.165 términos), número de productos en que aparece cada término, y su peso idf |
| `term_vec_int8_b64`, `term_scale` | Vectores de los términos: enteros de 8 bits en base64, con una escala por fila |
| `doc_vec_int8_b64`, `doc_scale` | Vectores de los productos, con el mismo formato |
| `sigma` | Valores singulares |
| `doc_ids` | `id` de cada fila de productos, en el orden del CSV |
| `version` | Nombre de la versión (`pp-lsa-2026-11-04`) |
| `textos_entrenamiento` | Número de textos con que se calcularon los pesos (2.782; ver [metodología](metodologia.md#reproducibilidad-del-modelo)) |

Para decodificar una matriz: valor = entero / 127 × escala de su fila. La [metodología](metodologia.md) explica cómo se usa cada parte.

Huella SHA-256 del archivo publicado: `eb448a446c51a86458845994457da9a9b28843e4a9c2172b88f79e571756e390`. Si cambia, cambió el modelo.

## `consultas_control.json`

Para cada consulta, el producto que debe salir primero y las palabras vecinas esperadas:

```json
{
  "vivienda": {
    "producto_esperado": {"id": "P1742", "nombre": "Subsidios de mejoramiento progresivo de vivienda ejecutados.", "similitud": 0.946},
    "vecinas_esperadas": ["vivienda", "habitacional", "vis", "vip", "arrendamiento", "subsidio", "progresivo", "localizado"]
  }
}
```

Las consultas son vivienda, empleo jóvenes, carga logística, humedal, mujeres rurales, turismo y datos abiertos. Son pruebas de regresión: comprueban que el visor reproduce el modelo, no que el modelo acierte según un juicio experto.

## Calidad de los datos: lo que conviene saber

- **Textos recortados.** Los textos muy largos llegaron recortados en la extracción con la que se armó este conjunto, a mitad de palabra:

  | Columna | Límite | Productos con el texto marcado con «…» |
  |---|---|---|
  | `indicador` | 250 caracteres | 239 |
  | `resultado` | 240 caracteres | 224 |
  | `objetivo` | 240 caracteres | 469 |
  | `dependencia` | 90 caracteres | 107 |
  | `producto` | hacia 390 caracteres | 49 |
  | `entidad` | 70 caracteres | 15 en el límite, que el catálogo resuelve con el nombre completo |

  - El corte es igual en los 47 planes, así que todo indica que se produjo al extraer los datos y no en la fuente.
  - Afecta sobre todo a las políticas étnicas: en el CONPES D.C. 40, 138 de 160 resultados están en el límite.
  - El visor marca con «…» los textos que llegan al límite de su columna y terminan a mitad de palabra (`recortado` en `scripts/construir.py`). El texto completo está en el plan oficial.
  - El modelo se entrenó con los textos recortados. Volver a extraerlos completos exige reentrenarlo.
- **Residuos de la extracción.** Algunos textos traen el retorno de carro escapado de Excel (`_x000D_`), tildes descompuestas (diez resultados del CONPES D.C. 8), espacios de ancho cero o una «ı» sin punto.
  - El visor los limpia al construir: forma NFC, sin escapes ni caracteres invisibles (`limpiar` en `scripts/construir.py`).
  - El modelo conserva el término «x000d», que el visor no muestra como vecina ni como sugerencia (`ocultos`).
- **Correos de personas.** Dos productos (P0461 y P0462) traen en `dependencia` el correo institucional de una persona junto al nombre de la dependencia. Así está en el plan publicado, y el CSV lo conserva. El visor no lo muestra (`sin_correos` en `scripts/construir.py`).
- **Códigos repetidos o vacíos.** El código de producto no identifica por sí solo una fila: nueve productos no lo traen, y en el Decreto 600 de 2023 dos productos distintos (P0942 y P0943) comparten el código 3.1. Por eso el identificador del visor es `id`, que solo vale dentro de un corte.
- **Celdas vacías.** Hay celdas vacías en `codigo` (9), `entidad` (29), `dependencia` (38) y `meta_final` (2). El visor las muestra vacías, salvo la entidad, que aparece como «Sin entidad en el plan».
- **Indicador numérico.** El producto P1549 trae en la columna de indicador un número (`5.7000000000000002E-3`) en lugar de un texto. Así está en la fuente, y por eso el vocabulario del modelo incluye la forma `7000000000000002e`.
- **Formas con cifras.** El vocabulario conserva tres formas más que vienen así de los textos: `1el`, `2aumento` y `2da`. El visor tampoco las muestra.
- **Metas de porcentaje.** En 766 de los 773 indicadores que empiezan por «Porcentaje», la meta viene como proporción, y el visor muestra su equivalente: «0,65 (proporción: 65 %)». Las demás escalas (100, «100,0%», «0.74%») se muestran tal como vienen.
- **Enfoques.** Vienen en texto libre. El visor los normaliza a nueve etiquetas con expresiones regulares (`ENFOQUES` en `scripts/construir.py`), lo que puede asignar mal casos ambiguos.
- **Corte fijo.** Los planes de acción se actualizan: estos datos reflejan lo publicado el 4 de noviembre de 2026. Para un corte nuevo, ver [actualizar los datos](actualizar-datos.md).

## Licencia

Ver [`LICENCIA-DATOS.md`](../LICENCIA-DATOS.md).
