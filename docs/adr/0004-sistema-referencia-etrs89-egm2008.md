# Sistema de referencia: ETRS89 horizontal + alturas elipsoidales WGS84 (con corrección EGM2008)

El GDT-Santiago ingiere la cartografía oficial española (LIDAR PNOA, MTN25, BTN25, CNIG) **tal cual** en ETRS89 UTM 29N, y en el pipeline offline convierte todas las altitudes ortométricas (Alicante) a altitudes elipsoidales WGS84 usando el modelo geoidal **EGM2008**. Los tiles Quantized Mesh y los MVT se publican ya en WGS84 con Z elipsoidal; el cliente CesiumJS los consume sin trucos y todo encaja. Sin esta corrección vertical, el terreno flotaría ~50 m sobre la imagen y los edificios quedarían hundidos en las laderas; por eso la corrección geoidal es una decisión arquitectónica, no un detalle de calidad.

**Considered options**
- ETRS89 horizontal + EGM2008 vertical (elegido) — coherente con la cartografía española, precisión ~10 cm, archivo geoidal libre de 10 MB.
- ETRS89 horizontal + `EGM08_REDNAP` del IGN (rechazado por ahora) — oficial español, más preciso en España, menos portable; puede sustituir a EGM2008 sin re-tiling si se observa deriva.
- WGS84 horizontal (reproyectar todo) — rechazado; pierde precisión sin aportar nada porque la diferencia ETRS89↔WGS84 en Galicia es sub-métrica.
- Sin corrección geoidal (rechazado) — el terreno flota ~50 m; el gemelo queda visualmente roto aunque el resto funcione.

**Consequences**
- El pipeline offline de terreno y de capas vectoriales con Z incluye un paso explícito EGM2008. Si se omite, el resultado es un MDE útil para nada más que análisis, no para un gemelo.
- La corrección se aplica una sola vez por dataset fuente; los tiles publicados no la vuelven a aplicar.
- Cualquier futura capa con altitudes (p. ej. un sensor de nivel de río) tiene que llegar al GDT ya en alturas elipsoidales WGS84, o se corrige en el pipeline con la misma receta.
