# COSKILLA V15 — guía de cambios

## Qué es real y qué depende de servicios

| Función | Estado |
| --- | --- |
| Registro local de obras, presupuestos, programas y jornadas | Funcional sin cuentas |
| Excel, PDF y Word de cada sección y de cada parte diario | Funcional sin API ni pago |
| Metrado valorizado diario con una columna por día | Funcional a partir de registros confirmados |
| Curvas y avance financiero con conceptos de presupuesto | Funcional cuando configuras y revisas los conceptos |
| Análisis narrativo por IA | Retirado de la interfaz en V15; el código queda inactivo en el servidor |
| Lectura de fotos con IA | Opcional; usa OpenAI y puede tener costo |
| Usuarios remotos y sincronización entre equipos | Suspendido en esta versión |

## Archivo de metrado valorizado diario

El modelo facilitado tiene una hoja de 31 columnas diarias y datos enlazados a otro libro. COSKILLA utiliza solo su estructura. Genera un libro nuevo con `Metrado diario`, `Valorizado diario`, `Control financiero` y, cuando existe línea base, `Curva S`. Cada columna de fecha usa **DD/MM/AAAA** y el mes tiene 28, 29, 30 o 31 días reales. Las filas de capítulos y subtotales conservan su lugar para lectura; solo las partidas con unidad y metrado aportan a los cálculos. El archivo se configura para impresión horizontal y fija los encabezados. PDF y Word separan las fechas en tramos de siete días para que se puedan leer en papel.

Los importes de la obra dependen de los reportes guardados y del presupuesto importado. No hay fórmulas ni vínculos externos del archivo modelo. Una exportación del día 10 no inventa avance del día 11 en adelante. Los espacios de firma no son firmas digitales.

## Configurar avance financiero

En **Ficha y archivos → Conceptos del presupuesto** indica el documento de sustento y revisa con tu expediente aprobado antes de activar la configuración. Todos los conceptos se valorizan como **porcentaje del costo directo valorizado** de cada día.

| Concepto | Por contrata | Administración directa |
| --- | --- | --- |
| Costo directo | Sí (metrado ejecutado × precio unitario) | Sí (presupuesto analítico) |
| Gastos generales fijos | Sí, en % ofertado | Sí, en S/ del expediente (se convierte a %) |
| Gastos generales variables | Sí, en % ofertado | Sí, en S/ del expediente (se convierte a %) |
| Utilidad | Sí, en % | No aplica |
| Subtotal | Se calcula | No se muestra |
| IGV | Sí, sobre el subtotal (0 % si los precios ya lo incluyen) | Solo si el presupuesto aprobado lo consigna como línea propia |
| Inspección / supervisión | No (la contrata la entidad por separado) | Sí, si el presupuesto de la obra lo incluye |
| Liquidación | No | Sí, si está presupuestada |
| Expediente técnico | No | Sí, si el presupuesto de la obra lo incluye |
| Otros costos aprobados | No | Sí |
| Reajustes, adelantos, amortizaciones, retenciones, mayores GG por ampliación de plazo, adicionales y deductivos | No se calculan; control contractual aparte | No aplican igual; control aparte |

Dónde se ve: **Dashboard trazabilidad** muestra la tabla de conceptos y la valorización diaria. Los Excel/PDF/Word incluyen, bajo «COSTO DIRECTO» en *Valorizado diario*, una fila por concepto y el «TOTAL VALORIZADO»; la hoja *Control financiero* lista el % de cada concepto y la hoja *Curva S* suma los importes acumulados (costo directo, total con gastos generales y total programado).

En administración directa, los **devengados documentados** (con fecha y comprobante) se registran aparte y se comparan con lo valorizado; no mueven la curva ni se mezclan con compras de almacén.

Referencias consultadas: Ley 31876 (el expediente técnico de una obra por administración directa incluye costos directos, gastos generales e impuestos, y el análisis de gastos generales); Directiva 017-2023-CG/GMPL de la Contraloría; opinión del OECE sobre gastos generales fijos y variables (los variables se relacionan con el tiempo, no estrictamente con un porcentaje del costo directo: aquí se siguen como % solo para seguimiento); valorizaciones por contrata con montos proporcionales de gastos generales y utilidad ofertados. Verifica siempre contra tu expediente, tu contrato y la normativa vigente.

## IA y arquitectura

> En V15 la interfaz no muestra opciones de IA. Lo que sigue describe el código que permanece inactivo en el servidor.

```
Navegador local → servidor local → datos de la obra en data/
                              ↘ motor de metrados, curvas y costos → Excel/PDF/Word
                              ↘ resumen minimizado → API OpenAI o Anthropic (opcional)
                                                    → análisis estructurado
                              ↘ validación de referencias → revisión humana → informe
```

La IA no edita la base de metrados ni los importes. Devuelve textos y una especificación de gráficos con referencias a indicadores calculados. COSKILLA rechaza referencias inexistentes y cifras literales no verificables, y desactiva el análisis aprobado si cambian sus fuentes. Para la generación, configura `AI_PROVIDER=openai` con `OPENAI_API_KEY` o `AI_PROVIDER=anthropic` con `ANTHROPIC_API_KEY`; si omites AI_PROVIDER, se usa el proveedor con clave disponible. Puedes cambiar el modelo mediante `OPENAI_MODEL` o `ANTHROPIC_MODEL`. Las tarifas, disponibilidad y límites dependen de tu cuenta y modelo: consúltalos con el proveedor antes de usar una obra real.

**API** es la conexión directa adecuada para esta función. **MCP** sería útil para consultar otros sistemas como almacenamiento o gestión documental en una fase posterior; no es imprescindible para generar el informe. Si quieres trabajar con clientes desde internet, habrá que diseñar un servidor central, autenticación, permisos y copias de seguridad. Esta V14 conserva el trabajo local y las cuentas suspendidas.

## Comprobar el flujo

1. Ejecuta COSKILLA desde la carpeta extraída.
2. Crea una obra de prueba. Adjunta presupuesto y programación, revisa la relación y aplica la línea base.
3. En Agenda diaria registra un metrado parcial y guarda la jornada. Comprueba que la partida y la curva se actualicen.
4. En Partidas y metrados descarga el Excel. Verifica los días, la unidad, la cantidad del día y el acumulado. Descarga el parte específico desde Reportes diarios.
5. Cambia la modalidad en una obra de prueba y configura los conceptos financieros. Verifica que contrata y administración directa muestren conceptos diferentes.
6. Descarga los Excel/PDF desde los botones superiores de Partidas y metrados, Movimiento de almacén y Dashboard trazabilidad.

Fuentes oficiales de referencia: [Contraloría, Directiva 017-2023-CG/GMPL](https://www.gob.pe/institucion/contraloria/normas-legales/4984570-017-2023-cg-gmpl); [OECE, Ley 32069 y reglamento actualizados](https://www.gob.pe/institucion/oece/informes-publicaciones/6444155-ley-n-32069-ley-general-de-contrataciones-publicas-y-su-reglamento-actualizados); [OpenAI, Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs); [Anthropic, Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
