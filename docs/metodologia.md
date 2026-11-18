# Metodología

Este documento explica qué hace el visor. La primera parte es para cualquier persona; la segunda da los detalles técnicos necesarios para auditarlo o reproducirlo.

## Para cualquier persona

La herramienta leyó los textos de los 2.764 productos vigentes de los planes de acción y aprendió qué palabras suelen aparecer juntas. Con eso, cuando escribes una palabra, encuentra los productos que tratan el mismo tema aunque no usen exactamente esa palabra. Por eso se llama **modelo semántico**: trabaja con el significado de las palabras, no solo con cómo se escriben.

### Paso a paso

1. **Reúne los textos.** De cada producto toma su nombre, su indicador y el resultado al que apunta. El nombre cuenta doble, porque es lo que mejor dice de qué se trata.

2. **Limpia las palabras.**
   - Pasa todo a minúsculas y quita tildes.
   - Descarta las palabras que no dicen nada del tema, como «de», «para», «implementado», «porcentaje» o «Bogotá», y las que aparecen en más de uno de cada cinco productos, como «persona», «estrategia» o «aumento»: son tan comunes que no distinguen temas. Si alguien las busca, el visor lo avisa.
   - Junta singular y plural: «mujeres» y «mujer» cuentan como la misma palabra.

   Queda un vocabulario de 4.165 palabras. Internamente se guardan sin tildes y a veces recortadas («genero», «diferent»), pero el visor muestra la forma más común en los textos («género», «diferentes»).

3. **Le da un peso a cada palabra.** «Gestión» aparece en 218 productos, así que casi no ayuda a distinguirlos. «Humedal» aparece en uno solo y dice mucho del producto que la usa. Es como subrayar con resaltador solo lo que hace distinto a cada texto.

4. **Descubre los temas de fondo.** El modelo revisa en qué productos aparece cada palabra y resume esos patrones en 128 temas de fondo.
   - Cada palabra y cada producto quedan ubicados según esos temas, como en un mapa.
   - Las palabras que se usan en contextos parecidos quedan cerca, aunque nunca estén en la misma frase. Junto a «vivienda» quedan «habitacional» (0,91), «VIP» y «VIS» (0,89), «arrendamiento» (0,86) y «subsidio» (0,85).
   - Nadie le dijo al modelo que esas palabras tienen que ver con vivienda: lo dedujo de cómo se usan en los planes.

5. **Compara tu búsqueda con cada producto.** Tu búsqueda se ubica en ese mismo mapa. La herramienta mide qué tanto apunta en la misma dirección que cada producto, con un número entre 0 (nada que ver) y 1 (el mismo tema).
   - Desde 0,30 la relación es **fuerte**, y entre 0,18 y 0,30, **media**.
   - Los productos que mencionan literalmente la palabra buscada, en singular o en plural, siempre están en la lista, como en Ctrl+F. Si se buscan varias palabras, entran los que las mencionan todas.
   - La diferencia con Ctrl+F está en los demás. De los 78 productos relacionados con «vivienda», 21 no usan esa palabra en ninguno de sus textos.
     - Algunos son pertinentes, como «Ruta de atención diferencial para el acceso de las comunidades indígenas a soluciones habitacionales» (0,25).
     - Otros solo comparten contexto, como «Subsidios de transporte escolar» (0,36).
     - Por eso la lista se lee de arriba abajo y con criterio.

6. **Dibuja la nube.**
   - Las palabras buscadas van al centro, rodeadas de sus vecinas.
   - Las políticas quedan alrededor, del lado de la palabra con la que más se relacionan. Cada punto es uno de sus productos: más grande, más relación.
   - La banda que une una política con una palabra es más gruesa y oscura cuantos más productos se relacionan y más fuerte es la relación.
   - La banda marca la **articulación temática**, es decir, en los textos. Crece con el tamaño del plan: una política con muchos productos tiende a tener bandas más gruesas. **No mide coordinación entre entidades ni entre políticas.**

Todo esto ocurre en el navegador de quien consulta: el modelo viene dentro de la página y no se envía nada a ningún servidor.

### De dónde salen los números

| Lo que ves | De dónde sale |
|---|---|
| Indicador, código, dependencia, objetivo y resultado | Copiados del plan de acción. Los textos muy largos llegaron recortados en la extracción y se marcan con «…» (ver [datos](datos.md#calidad-de-los-datos-lo-que-conviene-saber)). 1.325 indicadores empiezan por «Número» y 773 por «Porcentaje». |
| Entidad | Nombre normalizado: las 88 formas en que vienen escritas en los planes se agrupan en 52 entidades (catálogo en `datos/catalogos/entidades.csv`). |
| Enfoques | Agrupados en nueve etiquetas a partir del texto libre del plan. |
| Meta final | La del plan de acción, con coma decimal y sin los residuos de cálculo que guardan algunos archivos (por ejemplo, 1.0000000000000004 se muestra como 1). En 766 de los 773 indicadores de porcentaje la meta viene como proporción, y el visor muestra su equivalente: «0,65 (proporción: 65 %)». |
| Relación (0,00 a 1,00) | Calculada por el modelo. **No es un porcentaje**: 0,85 no significa 85 % de nada. Sirve para ordenar, y 0,60 no es el doble de relación que 0,30. Como referencia, dos productos de políticas distintas tomados al azar tienen una relación mediana de 0,03. |
| «53 de 55 productos» | Conteo: de los 55 productos vigentes de esa política, 53 se relacionan con la búsqueda. |
| «53 de 55 productos (96 %)» | El porcentaje sí es una proporción: la parte del plan que se relaciona con la búsqueda. |
| Intensidad de una banda | Suma de la relación con esa palabra de los productos relacionados de la política que tienen 0,18 o más. |
| «Políticas con textos más parecidos» | Coseno entre los centros de los productos de dos políticas. La mediana entre dos políticas cualesquiera es 0,12. Un valor alto indica textos parecidos, no coordinación. |

La herramienta **no verifica ni actualiza** los datos de los planes y **no muestra avances**: la meta final es lo que el plan se propone, no lo que se ha logrado.

### Para qué sirve y para qué no

**Sirve para:**
- encontrar productos de distintas políticas que hablan de lo mismo;
- explorar con qué temas se relaciona una política;
- preparar una revisión de posibles articulaciones o vacíos temáticos.

**No sirve para:**
- afirmar que dos políticas duplican metas o que son jurídicamente equivalentes;
- medir avance o cumplimiento;
- evaluar presupuesto;
- concluir que una política «no trabaja» un tema porque no aparece en la nube: puede usar otras palabras, o el tema puede estar en documentos distintos al plan de acción.

## Detalles técnicos

### Corpus y vocabulario

- **Documentos:** cada producto vigente es un documento. Su texto es nombre ×2 + indicador + resultado. El objetivo específico no entra en el modelo.
- **Reglas de palabras**, iguales en el entrenamiento y en el navegador (`tokens()` en `src/motor.js`):
  1. Minúsculas y descomposición NFD sin marcas diacríticas. La «ñ» queda como «n».
  2. Todo lo que no sea `[a-z0-9]` se reemplaza por un espacio.
  3. Se conservan las palabras de 3 o más caracteres que no están en la lista de palabras vacías y no son solo cifras.
  4. Se unen singular y plural: se quita «es» final si la palabra tiene más de 5 letras, o «s» final si tiene más de 4.
- **Palabras demasiado frecuentes:** se descartan las que aparecen en más del 20 % de los productos. En este corte son tres: «aumento», «persona» y «estrategia». `scripts/construir.py` comprueba que el vocabulario del modelo sea exactamente el de los productos sin ellas.

### TF-IDF y análisis semántico latente

- **TF-IDF:**
  - frecuencia sublineal de cada término en el documento, `1 + ln(tf)`, por idf suavizado, `idf = ln((1 + N) / (1 + df)) + 1`;
  - cada documento normalizado a longitud 1 (norma L2).
- **Descomposición:** en valores singulares truncada a k = 128, `X ≈ U Σ Vᵀ`.
  - Vector de cada término: su fila de **V**.
  - Vector de cada producto: **X·V**, normalizado.
  - **Σ** se guarda como `sigma`.
- **Almacenamiento:**
  - las matrices van en enteros de 8 bits con una escala por fila (valor = entero / 127 × escala), codificadas en base64;
  - los demás números van redondeados: el modelo publicado guarda el idf con 3 decimales, y `scripts/entrenar_modelo.py` escribe 6 cifras significativas.
- **Consulta:**
  - q = Σ idf(t) · V(t) sobre los términos buscados, normalizado;
  - una palabra reúne los términos del modelo que comparten raíz: singular y plural a veces quedaron como términos distintos («adolescente» y «adolescent», de «adolescentes»), y así dan la misma búsqueda;
  - la relación con cada producto es el coseno entre q y su vector.

### Relación y umbrales

- **Umbrales:** relación fuerte desde 0,30 y media desde 0,18.
- **Lista de resultados:** reúne los productos con relación de 0,18 o más. Siempre se muestran además los 10 primeros y los productos que mencionan literalmente lo buscado: una expresión, la palabra buscada (en singular o en plural) o, si se buscan varias palabras, todas a la vez. Con varias palabras no se suma la unión de lo que menciona cada una, para no diluir la búsqueda.
- **Sensibilidad a k.** Los umbrales son absolutos y dependen del número de dimensiones. En un reentrenamiento exacto, en las 300 palabras más frecuentes, la mediana de productos con relación de 0,18 o más pasa de 148 con k = 96 a 107 con k = 128 y a 81 con k = 192. El valor k = 128 viene del procedimiento original, y el repositorio no documenta una comparación sistemática entre valores. Si cambia el modelo o k, hay que recalibrar los umbrales y las bandas.
- **Referencia para leer los umbrales** (se recalcula con `node pruebas/cifras_de_referencia.js`):
  - entre dos productos de políticas distintas tomados al azar, la similitud mediana es 0,03 y solo el 6 % de esos pares llega a 0,18;
  - el producto más parecido de otra política tiene, en la mediana, una similitud de 0,56.

### Palabras vecinas

- **Similitud entre palabras:** coseno entre las filas de V·Σ normalizadas.
- **Vecinas en la nube:** las palabras más cercanas a cada palabra buscada, sin contar términos que aparecen en un solo producto, más hasta cuatro expresiones del diccionario que estén al menos tan cerca como la décima palabra vecina.
  - La nube muestra 16, 12 o 9 vecinas por palabra, según se busquen una, dos o tres palabras; en pantallas pequeñas, 12, 8 o 6.
  - La cercanía de una expresión vecina se multiplica por 0,92 para no desplazar a las palabras sueltas, y la ficha muestra ese valor.
  - Las vecinas también aparecen como lista de botones bajo la nube, para leerlas con lector de pantalla o sumarlas con el teclado.
  - No se muestran términos que son residuos de la extracción («x000d», «1el», «2aumento»), aunque sigan en el modelo.

### Unidades de significado

Una expresión de varias palabras se lee como una sola unidad si aparece **literalmente** en algún producto:
- palabras de contenido contiguas, con hasta dos conectores («de», «con», «para»…) entre ellas;
- sin cruzar signos de puntuación;
- unificando singular y plural.

**Su vector** combina dos cosas: el centro de los productos que la mencionan (peso λ = ½ · n / (n + 2), donde n es el número de productos que la mencionan) y la suma de los vectores de sus palabras ponderados por idf. Así suben también los productos que dicen lo mismo con otras palabras, como «habitabilidad en calle» para «habitante de calle». El modelo no se reentrena para esto: todo se calcula en el navegador.

**El diccionario de 700 expresiones** (sugerencias al escribir y vecinas subrayadas) sale del propio corpus (`diccionario_y_perfiles` en `scripts/construir.py`). Una expresión de dos o tres palabras entra si:
- aparece en al menos 4 productos de 2 o más políticas y no repite palabras;
- tiene cohesión suficiente:
  - en las de dos palabras, la expresión aparece en al menos el 15 % de los productos de su palabra menos frecuente;
  - en las de tres, aparece en al menos el 60 % de los productos de la más frecuente de sus dos sub-expresiones de dos palabras;
- no aparece casi siempre dentro de otra más larga: se descarta si una expresión que la contiene tiene al menos el 80 % de sus productos.

De las que cumplen, se guardan las 700 que aparecen en más productos, cada una con la forma escrita más común.

### Bandas: intensidad de la articulación temática

- **Intensidad de la banda entre la palabra p y la política P:** suma de la relación con p de los productos relacionados de P (los de la lista) que tienen 0,18 o más con p.
  - Con dos o tres palabras, un producto con 0,18 o más con una de ellas, pero fuera de la lista porque su relación con la búsqueda completa es baja, no cuenta. La banda resume lo que la lista muestra.
  - Como suma, crece con el tamaño del plan: 15 productos de un plan de 192 pueden dar la misma banda que 15 de un plan de 31. Por eso la ficha de cada política muestra también «n de N productos (x %)».
  - Es articulación **temática**, en los textos. No mide coordinación entre entidades ni entre políticas.
- **Cinco niveles con umbrales fijos, iguales en cualquier búsqueda:**

| Nivel | Intensidad | Ejemplo |
|---|---|---|
| Muy baja | menos de 0,3 | un solo producto con relación media |
| Baja | 0,3 a 0,8 | |
| Media | 0,8 a 2 | |
| Alta | 2 a 5 | |
| Muy alta | 5 o más | 16 productos con relación de 0,33 |

- **Calibración:** los umbrales se calibraron con la distribución de todas las búsquedas de una palabra con df ≥ 5. Con ellos, el 55 % de las búsquedas muestra los cinco niveles.
- **Color:** rampa de un solo tono, de rosa a rojo oscuro. Su luminosidad baja de forma monótona. El tono más claro tiene un contraste de 2,6:1 con el plano, por debajo del 3:1 que pide WCAG para objetos gráficos; se mantuvo para conservar la gradiente clara, y el nivel también se lee por el grosor, la ficha y el índice de políticas.

### Perfil de política, afinidad y productos parecidos

- **Palabras frecuentes en su plan:** palabras y expresiones de los nombres e indicadores de la política que cumplen cuatro condiciones:
  1. aparecen en al menos max(3; 4 % de sus productos);
  2. son al menos 2,5 veces más frecuentes en ella que en el conjunto. La proporción dentro de la política se cuenta en nombre e indicador, y la del conjunto, en nombre, indicador y resultado;
  3. las palabras sueltas tienen 5 letras o más, por lo que «paz» o «agua» nunca salen como palabra suelta;
  4. tienen el puntaje más alto de proporción × ln(N / df), con 2,2 veces más peso para las expresiones. Se eligen hasta cinco.

  Reflejan la redacción del plan, no sus prioridades.
- **Políticas con textos más parecidos:** coseno entre los centros (vectores promedio normalizados) de todos los productos de cada política. La mediana entre dos políticas cualesquiera es 0,12. Un valor alto indica textos parecidos, no coordinación.
- **Productos parecidos:** usa el vector del producto de referencia como búsqueda.

### Enfoques

La columna de enfoques viene en texto libre, con unas 170 variantes. Se normaliza a nueve etiquetas con expresiones regulares (`ENFOQUES` en `scripts/construir.py`): Género, Poblacional, Diferencial, Territorial, Derechos humanos, Ambiental, Étnico, Curso de vida y Cultura ciudadana. Un producto puede tener varias etiquetas o ninguna.

## Validación

### Consultas de control

Hay siete consultas de control en `datos/pruebas/consultas_control.json`, que corren con `pruebas/validar_modelo.js` y también en el visor, en «Fuente y método».
- **Qué comprueban:** que el producto más relacionado sea el esperado y que al menos 4 de las 6 primeras vecinas esperadas aparezcan entre las 6 obtenidas.
- **Qué son:** **pruebas de regresión**. Garantizan que el visor responde igual que el modelo que se revisó; no son una medida de calidad contra un juicio humano. Algunas vecinas esperadas son ruido del modelo, como «contenga» o «recaudo»: se fijan porque describen cómo responde, no porque sean buenas.
- **Pruebas automáticas adicionales** (`pruebas/probar_unidades.js`):
  - singular y plural dan la misma lista;
  - todas las palabras de cada producto están en el índice de menciones;
  - los textos del visor están limpios;
  - los residuos de Excel no salen como vecinas.

### Evaluación pendiente: calidad frente a un juicio humano

Ninguna prueba del repositorio mide todavía si los resultados son pertinentes. Se propone este protocolo, que toma cerca de un día de trabajo por persona:
1. **Consultas.** Cuarenta, por estratos: 15 palabras frecuentes, 10 raras, 10 expresiones del diccionario y 5 combinaciones, incluidas parejas singular/plural.
2. **Productos a calificar.** Para cada consulta, los 20 primeros productos del modelo publicado, del modelo reentrenado y de la búsqueda literal.
3. **Calificación.** Dos especialistas en políticas califican cada producto sin saber de qué modelo viene: 0 si no es pertinente, 1 si lo es en parte y 2 si es pertinente.
4. **Medidas.** Precisión en los 10 primeros, nDCG@10, acuerdo entre calificadores (kappa de Cohen) y precisión por nivel de relación, para contrastar los umbrales 0,18 y 0,30 con el juicio humano.

Con eso se puede decidir si se adopta el modelo reentrenado y si los umbrales son los adecuados.

### Reproducibilidad del modelo

`scripts/entrenar_modelo.py` aplica el procedimiento descrito arriba con una descomposición exacta (ARPACK), así que su resultado no depende de una semilla.

Dos parámetros del procedimiento original no estaban documentados y se reconstruyeron comparando con el modelo publicado: la frecuencia sublineal y el descarte de palabras en más del 20 % de los productos. Con ambos, el vocabulario reentrenado coincide término a término con el publicado (4.165 términos), y la coincidencia de resultados sube de 73 % a 88 %.

**Diferencias con el modelo publicado.** El modelo que usa el visor (`datos/modelo/modelo_semantico.json`, versión `pp-lsa-2026-11-04`) se entrenó con el mismo procedimiento, pero:
- sobre un corpus algo mayor: 2.782 textos, de los cuales 18 quedaron luego fuera del alcance del visor. Por eso sus pesos idf no coinciden con la fórmula aplicada a los 2.764 productos actuales, aunque el vocabulario y la columna `df` sí corresponden a ellos;
- con una descomposición aproximada (aleatorizada), cuyo resultado depende de la semilla.

**Comparación sobre las 300 palabras más frecuentes:**

| Medida | Resultado |
|---|---|
| Coincidencia de los 10 primeros productos | 88 % |
| Correlación de las relaciones | 0,95 |
| Coincidencia de las 10 primeras vecinas | 90 % |
| Consultas de control | 5 de 7. En las otras dos cambia el primer producto por uno igual de pertinente: «empleo jóvenes» da «Jóvenes vinculados a la Estrategia de empleo para jóvenes…» y «carga logística», «Restricciones de circulación al transporte de carga…» |

Las relaciones gruesas, es decir qué políticas y qué temas se relacionan, se mantienen. El orden fino entre productos cercanos cambia. Por eso **conviene leer los resultados como tendencias y no como un ordenamiento exacto**. Un cambio de modelo en el visor debe ir acompañado de nuevas consultas de control revisadas.

## Límites conocidos

- **Bolsa de palabras.** El modelo no ve el orden ni las negaciones.
- **Palabras raras.** Una palabra que aparece en pocos productos tiene vecinas que reflejan esos pocos contextos. «Humedal» aparece en un solo producto.
- **Normalización simple.** La regla de singular y plural es simple: une palabras como «mujer» y «mujeres», pero también puede unir o separar palabras que no debería. Algunas expresiones del diccionario son fragmentos poco naturales.
- **Enfoques.** La normalización a nueve etiquetas puede asignar mal casos ambiguos.
- **Textos recortados.** Los textos muy largos llegaron recortados en la extracción: indicadores a 250 caracteres, resultados y objetivos a 240, nombres de producto hacia 390. El modelo se entrenó con esos textos.
- **Residuos de Excel.** Algunos residuos entraron al vocabulario del modelo, como «x000d», que viene del retorno de carro escapado. El visor los oculta, pero sacarlos del todo exige reentrenar.
- **Corte fijo.** Los planes de acción cambian: el visor refleja el corte del 4 de noviembre de 2026.
