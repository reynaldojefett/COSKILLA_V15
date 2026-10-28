# Componentes incluidos en COSKILLA V14

- **MPXJ 16.10.0** y sus dependencias: lectura local de Microsoft Project y Primavera. Distribución y licencias en `tools/mpxj`.
- **Apache POI 5.5.1**: lectura de Excel antiguo `.xls`; sus licencias están dentro de los JAR distribuidos con MPXJ.
- **JSZip**: empaquetado de Excel y Word; licencia en `public/vendor/JSZIP-LICENSE.md`.
- **pdf-lib**: generación local de PDF; licencia en `public/vendor/PDF-LIB-LICENSE.md`.
- **Public Sans**: tipografía libre SIL OFL 1.1; archivos y licencia en `public/assets/fonts`.

`tools/CoskillaReader.java` y su clase compilada leen formatos antiguos con Java 11 o posterior. Ninguno de estos componentes conecta la obra a un servicio de pago para exportar archivos. La IA opcional sí puede consumir una API externa.
