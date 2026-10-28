# COSKILLA V15 — uso local sin cuentas

Esta versión toma como base COSKILLA_V13_sin-cuentas.zip. Funciona en esta computadora; las cuentas y el acceso remoto están suspendidos. Los nombres de responsable son datos declarados, no usuarios autenticados. Tus obras se guardan en la carpeta `data` de la instalación donde trabajas. El ZIP de entrega no incluye tus obras ni claves.

## Abrir

1. Extrae **todo** `COSKILLA_V15_sin-cuentas.zip` en una carpeta. No ejecutes el iniciador desde dentro del ZIP.
2. Instala Node.js 24 si aún no lo tienes. Ejecuta `INICIAR_COSKILLA.cmd` y mantén abierta la ventana.
3. Abre la dirección local que aparece en la consola, normalmente `http://127.0.0.1:8890`. Si no ves los cambios, usa Ctrl+F5.
4. Para continuar una obra anterior, primero haz copia de su carpeta `data` y cópiala dentro de la carpeta extraída. Nunca sobrescribas la `data` anterior sin respaldo.

## Avance diario y exportación

En **Agenda diaria** registra el metrado ejecutado. Al guardar una jornada, la aplicación utiliza las partidas, unidades, precios y fechas de tu obra. Elige la fecha de corte y descarga **↓ Excel** o **↓ PDF** con los botones superiores de **Partidas y metrados**, **Movimiento de almacén** o **Dashboard trazabilidad**. En **Reportes diarios** puedes descargar también el parte de una jornada concreta en los tres formatos. Todas las secciones principales tienen esos tres formatos. No hay descarga LaTeX ni se necesita un compilador TeX.

La hoja Excel de **Metrado diario** toma el diseño del modelo enviado: membrete con obra y responsables, ítem, descripción, unidad, metrado base, modificaciones, acumulado anterior, una columna por cada día real del mes, total del mes y acumulado al corte. Otra hoja muestra el valorizado diario y otra el control financiero. Se conserva el orden de partidas y capítulos importados. Los datos, fórmulas y vínculos externos del modelo adjunto **no** se copian. Los números se calculan con los registros de la obra actual. PDF y Word presentan los mismos datos en bloques legibles de siete días y dejan espacios para firma manuscrita.

Un día posterior al corte se muestra sin avance. Una jornada anulada no suma. El documento identifica los datos de demostración si estás usando una obra ficticia. Es un informe de seguimiento; revisa y aprueba las valorizaciones contractuales por el procedimiento que corresponda.

## Avance financiero (gastos generales en adelante)

El avance financiero y la curva S consideran **el costo directo más los conceptos del presupuesto aprobado**. Cada concepto se muestra como porcentaje del costo directo y se valoriza día a día sobre el costo directo valorizado de ese día. Mira el resultado en **Dashboard trazabilidad** (tabla de conceptos y valorización diaria) y en los Excel/PDF de **Partidas y metrados**, **Movimiento de almacén** y **Dashboard trazabilidad**.

**Por contrata** (Ficha y archivos → Conceptos del presupuesto): costo directo + gastos generales fijos (%) + gastos generales variables (%) + utilidad (%) = subtotal; IGV (%) sobre el subtotal (0 % si los precios ya lo incluyen). No se agregan supervisión ni expediente técnico de la entidad, reajustes, adelantos, retenciones ni mayores gastos generales por ampliación de plazo.

**Administración directa**: costo directo + los importes del presupuesto aprobado del expediente técnico: gastos generales fijos y variables, inspección/supervisión, liquidación, expediente técnico, otros costos aprobados e impuestos solo si el presupuesto los consigna. COSKILLA convierte cada importe en % del costo directo. No hay utilidad. Los devengados documentados se registran aparte y se muestran como comparación; no mueven la curva.

La pantalla **Conceptos del presupuesto** trae la guía «Qué conceptos se consideran» de cada modalidad. Tu presupuesto aprobado manda sobre esa guía. Los gastos generales variables dependen del plazo; aquí se siguen como % del costo directo valorizado solo para seguimiento diario, no como valorización contractual.

## Inteligencia artificial

En V15 se retiraron de la interfaz el panel de IA y la barra «Exportar esta sección». Excel, PDF, Word, metrados y curvas funcionan sin IA ni clave. El código de análisis con IA permanece en el servidor sin botón; si no lo necesitas, puede eliminarse por completo.

## Respaldo y límites

Guarda una copia periódica de `data` o descarga el respaldo desde la guía de la aplicación. La versión local permite trabajar desde esta computadora; el enlace público anterior es solo una demostración y no comparte tus obras. No se han creado cuentas reales ni un servicio de sincronización.

Consulta [GUIA_V15.md](GUIA_V15.md) para detalle de formatos, costos e IA.

