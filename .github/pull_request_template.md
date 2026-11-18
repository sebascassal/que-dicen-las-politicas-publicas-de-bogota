## Qué cambia y por qué

<!-- Describe el cambio y el problema que resuelve. Si corrige un aviso, enlázalo (por ejemplo «Corrige #12»). -->

## Comprobaciones

- [ ] `python3 scripts/construir.py` y `dist/index.html` incluido en el cambio
- [ ] Si cambia un archivo de `datos/`: `python3 scripts/construir.py --huellas`
- [ ] `python3 pruebas/verificar.py --rapido` termina con «VERIFICACIÓN COMPLETA: todo pasa»
- [ ] Si cambia la interfaz: `python3 pruebas/verificar.py` completo y capturas antes y después
- [ ] Si cambian datos, modelo o umbrales: documentación y cifras de referencia actualizadas (`docs/`, `node pruebas/cifras_de_referencia.js`)
- [ ] `CHANGELOG.md` actualizado
