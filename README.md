# COSKILLA V15

Aplicación local para el control del avance de obra. Relaciona el presupuesto, la programación, los partes diarios y los movimientos de almacén, y permite consultar y exportar la información al corte.

## Requisitos

- Node.js 22 o posterior; se recomienda Node.js 24.
- Java 11 o posterior para leer archivos antiguos de Excel y cronogramas MPP/XER mediante el lector incluido.
- Un navegador web.

## Iniciar

1. Descarga el repositorio con **Code → Download ZIP** y extrae todo su contenido, o clónalo con Git.
2. En Windows, ejecuta `INICIAR_COSKILLA.cmd` y conserva abierta la ventana.
3. Abre la dirección que indica la consola, normalmente <http://127.0.0.1:8890>.

También puedes iniciar desde una terminal dentro de la carpeta:

```sh
node server.mjs
```

La aplicación no requiere instalar paquetes de npm para iniciarse; las bibliotecas utilizadas se incluyen en el repositorio.

## Funciones

- Importación del presupuesto y la programación de obra.
- Relación y revisión de partidas y actividades.
- Registro del avance diario y control de recursos.
- Seguimiento físico y financiero según la modalidad configurada.
- Tableros de trazabilidad y exportación a Excel, PDF y Word.

## Datos y configuración

Esta versión trabaja de forma local, sin cuentas ni sincronización remota. Las obras se guardan en `data/` dentro de la instalación. Esa carpeta, las claves y los archivos `.env` están excluidos de Git.

Los registros manuales, los cálculos y las descargas funcionan sin una clave de IA. Si necesitas configurar las funciones opcionales del servidor, utiliza `.env.example` como referencia y guarda los valores solo en tu archivo `.env` local.

Los ejemplos y las plantillas se encuentran en `examples/` y `public/`. No sustituyen la revisión de los documentos y registros de cada obra.

## Pruebas incluidas

```sh
node --test tests/finance-v15.test.mjs
```

## Documentación

- [Guía de uso](LEEME.md)
- [Detalle de la versión V15](GUIA_V15.md)
- [Componentes y licencias de terceros](THIRD_PARTY.md)

Las bibliotecas de terceros conservan sus licencias en las carpetas correspondientes.
