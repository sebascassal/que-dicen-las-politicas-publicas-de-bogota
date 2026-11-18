# Cómo contribuir

Gracias por querer mejorar el visor. Son bienvenidos:
- los avisos de errores en los datos;
- los problemas de uso en algún navegador;
- las propuestas de método y las correcciones de documentación.

## Avisar de un problema

Abre un aviso (*issue*) con la plantilla que corresponda:

- **Error en los datos.** Un producto, una meta o un nombre no coincide con el plan de acción oficial. Indica el producto (por ejemplo P1742) y el enlace al plan.
- **Algo no funciona en el visor.** Copia la dirección de la página, que incluye la búsqueda, e indica navegador y dispositivo.
- **Propuesta.** Cuenta qué necesidad resuelve y quién la tiene.

## Proponer un cambio

1. **Prepara el entorno.** Basta Python 3.9+ y Node 18+. Para las pruebas en navegador hace falta además `pip install -r pruebas/requirements.txt` y Chrome.
2. **Haz el cambio donde corresponde:**
   - **Código de la página:** `src/` (ver [arquitectura](docs/arquitectura.md));
   - **Datos:** `datos/` (ver [datos](docs/datos.md) y [actualizar los datos](docs/actualizar-datos.md));
   - **Documentación:** `docs/` y los archivos de la raíz.
3. **Reconstruye el visor** con `python3 scripts/construir.py`. Si cambiaste un archivo de `datos/`, corre antes `python3 scripts/construir.py --huellas`. `dist/index.html` se versiona, para que cualquiera pueda descargarlo listo.
4. **Verifica** con `python3 pruebas/verificar.py --rapido`. Si tocaste la interfaz, corre `python3 pruebas/verificar.py` completo.
5. **Anota el cambio** en `CHANGELOG.md`, en la sección «Sin publicar».
6. **Abre la solicitud de cambio** (*pull request*) y completa la lista de comprobación.

## Criterios del proyecto

- **Fidelidad a la fuente.** Los datos se copian de los planes de acción sin reinterpretarlos. Una corrección de datos debe citar el plan oficial.
- **Prudencia en la lectura.** El visor mide cercanía temática entre textos. Ningún texto, color o etiqueta debe sugerir duplicidad, cumplimiento o evaluación de políticas.
- **Un solo archivo, sin peticiones externas.** No se agregan bibliotecas, servicios de analítica ni recursos remotos. Lo que haga falta va incrustado.
- **Accesible.** Todo lo que muestra la nube debe poder leerse también en la lista y con teclado. El color no puede ser el único portador de información.
- **Reproducible.** Los mismos datos y el mismo código dan el mismo archivo. Las cifras citadas en la documentación se pueden recalcular (`pruebas/cifras_de_referencia.js`).
- **Cambios de modelo con evidencia.** Un modelo nuevo se acompaña de la comparación con el anterior y de consultas de control revisadas por una persona.

## Estilo

- **Idioma.** Textos, comentarios y documentación en español de Colombia. Los nombres de variables siguen el estilo del archivo que se edita: el motor y la aplicación usan nombres cortos en inglés de versiones anteriores, y los scripts de Python, nombres en español.
- **Formato.** Sangría de 2 espacios en JavaScript, CSS y HTML, y de 4 en Python. UTF-8 y fin de línea LF, salvo los CSV de datos, que van con BOM y CRLF. `.editorconfig` lo configura en la mayoría de editores.
- **Escritura.** Frases claras y cortas. La documentación se escribe para personas que no conocen el método.

- **Sin datos personales.** El visor no muestra nombres, correos ni teléfonos de personas, aunque vengan en un plan. Si encuentras uno, avisa como indica [SECURITY.md](SECURITY.md).

## Convivencia

Este es un proyecto cívico. Se espera un trato respetuoso, sin descalificaciones personales ni políticas, y con discusiones centradas en los datos y el método. Las reglas completas están en [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
