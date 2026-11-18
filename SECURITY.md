# Seguridad y datos personales

## Qué versiones se corrigen

Solo la última versión publicada (ver [CHANGELOG.md](CHANGELOG.md)).

## Cómo avisar de un problema de seguridad

No abras un aviso público. Usa el aviso privado de GitHub: en la pestaña **Security** del repositorio, **Report a vulnerability**. Si esa opción no aparece, abre un aviso (*issue*) que diga solo que quieres reportar un problema de seguridad, sin detalles, y espera la respuesta.

Cuenta, en lo posible:
- qué versión del visor usaste (está en el pie de la página);
- el navegador y el dispositivo;
- los pasos para reproducir el problema, y la dirección completa de la página si interviene (por ejemplo `#q-…`).

Este es un proyecto cívico mantenido en tiempo libre. La respuesta puede tardar unos días.

## Qué cuenta como problema de seguridad

- Que un texto de los datos o de la dirección de la página llegue a ejecutarse como código.
- Que la página haga una petición a otro servidor o guarde algo en el navegador.
- Que un enlace del visor lleve a un sitio que no sea oficial del Distrito.
- Que una tabla copiada ejecute una fórmula al pegarla en una hoja de cálculo.
- Que los flujos de GitHub Actions permitan publicar código que no esté en la rama principal.

Cómo se protege el visor contra esto está en [docs/arquitectura.md](docs/arquitectura.md#seguridad).

## Datos personales

Los datos del visor vienen de documentos públicos de la Secretaría Distrital de Planeación y no deberían traer datos de personas. Si encuentras un nombre, un correo o un teléfono de una persona en el visor o en `datos/`, avisa con la plantilla **Error en los datos** e indica el producto (por ejemplo P0461), sin copiar el dato en el aviso.

Lo ya conocido está en [docs/datos.md](docs/datos.md#calidad-de-los-datos-lo-que-conviene-saber).
