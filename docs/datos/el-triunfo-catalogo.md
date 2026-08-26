# Catálogo territorial — Cantón El Triunfo (Guayas)

Base para el seed de la Fase 0. Investigado el 2026-08-26.

**Fuentes principales**
- **[PDOT]** Plan de Desarrollo y Ordenamiento Territorial, GAD El Triunfo 2019–2023 — https://el-triunfo.gob.ec/2020/admi/doc/RC_58_1.pdf
- **[PT]** Plan de Trabajo 2019–2023 (CNE), alojado en el sitio municipal — https://el-triunfo.gob.ec/2020/admi/doc/RC_55_1.pdf
- **[OSM]** OpenStreetMap, relación 285105 — https://www.openstreetmap.org/relation/285105
- **[INEC]** Censo 2022 vía citypopulation.de — https://www.citypopulation.de/en/ecuador/admin/guayas/0909__el_triunfo/

⚠️ No existe publicada una lista oficial única y completa de ciudadelas. Esta se reconstruyó cruzando documentos municipales con OSM.

⚠️ El PDF que devuelven los buscadores como "PDOT El Triunfo 2020-2023" en `gadeltriunfo.gob.ec` corresponde a **El Triunfo de Patate, Tungurahua** — NO usar.

---

## 1. Ciudadelas urbanas — CONFIRMADAS por documento municipal

Cargar estas como catálogo base (`verificado: true`).

Las Palmas 1 · Las Palmas 2 · Assad Bucaram · Barrio Colonial · Barrio 17 de Septiembre ·
Lotización Mosquera · Velasco Ibarra · Cooperativa Patria Nueva · 12 de Agosto · La Victoria ·
San José · Pedro Menéndez Sector A · Pedro Menéndez Sector B · Abdón Calderón · Genaro Maridueña ·
Santa Rosita · 6 de Julio · María Auxiliadora · Primavera · Inga · El Paraíso ·
**Arbolito 2** · **Arbolito 3** · San Fernando · Aníbal Zea 1 · Aníbal Zea 2 · Aníbal Zea Empleados ·
San Pedro 1 · San Pedro 2 · San Pedro 3 · La Carmela 1 · La Carmela 2 · Primero de Mayo ·
Río Guayas · Yolanda Vallejo · Río Verde · Huancavilca · Jaime Roldós · Santa Zoila ·
Che Guevara · Nuevo Amanecer 1 · Nuevo Amanecer 2 · Agua Santa 1 · Agua Santa 2 ·
Guayaquil · Yaguachi · Bellavista · Blanca Coello · Isabel · Virgen del Cisne · 25 de Agosto ·
Jaime Hurtado 1 · Jaime Hurtado 2 · Nueva Jerusalén · Santa Marianita · Triunfo 87 ·
Divino Niño · San Jacinto 1 · San Jacinto 2 · Centro Poblado Río Verde ·
Patria Nueva A · Patria Nueva B · Patria Nueva C · La Paz

**Del plano urbano del PDOT** (texto vectorial fragmentado — contrastar con alguien local antes de producción):
San Lorenzo · Óscar Calle · Niño de Praga · Roberto Calle · Unión y Progreso · 14 de Mayo ·
Sindicato de Choferes · Flores Cordero · San Rafael · Lotización Paquita Flores

## 2. Ciudadelas urbanas — solo en OSM (`verificado: false`)

Todas dentro del polígono urbano, a menos de ~2,8 km del centro (−2.3317, −79.4026):

**Lotización La Cartonera** (2,71 km) · **Arbolito 1** (1,29 km) · El Muro de Berlín (0,48 km) ·
Santa Rosa (0,55 km) · Patria Nueva D (1,04 km) · El Rocío (1,69 km) · El Chófer (2,10 km) ·
Cristo Peregrino (2,40 km) · Lotización Lenín Moreno Garcés · Lotización Pedro Ricardo

## 3. Notas sobre nombres

| Nombre | Estado |
|---|---|
| Arbolito 2 | Confirmado (PT + OSM) |
| Arbolito 3 | Confirmado (PDOT + OSM) |
| Arbolito 1 | Solo OSM — existe, incluir |
| La Cartonera | Solo OSM, como "Lotización La Cartonera" |
| **Centro** | **NO es una ciudadela documentada.** Los documentos dicen "casco urbano" / "centro de la ciudad" como descripción funcional. Incluir como sector funcional si se quiere, marcado aparte |

**Nombres duplicados urbano/rural — NO fusionar:** Las Palmas 1 y 2, Río Guayas, Primero de Mayo, San Pedro. Cada uno existe como ciudadela urbana Y como recinto rural distinto.

**Ambiguos:** "Los Pinos" (¿ciudadela o quinta turística?) · "Sindicato de Choferes" vs "El Chófer" (¿el mismo lugar?) · "Los Naranjos" y "Cooperativa 1 de Septiembre" (OSM los marca urbanos pero están a 7–8 km; los documentos los listan como recintos rurales).

---

## 4. División política

**El cantón tiene UNA sola parroquia: la parroquia urbana El Triunfo. No hay parroquias rurales.** Lo rural se organiza por *sectores* y *recintos*.

### Sector Colonia Agrícola Amazonas (21 recintos)
El Piedrero · Chilcales · Estero Claro · San Francisco · Pueblo Nuevo · María Teresa · San Eduardo ·
La Unión · Blanca Flor · El Ají · Playa Seca · Colonia Agrícola Amazonas · Los Francos · San Pedro ·
10 de Agosto · San Isidro · San Pablo · San Pascual · Santa Ana · Primero de Mayo · Cutuguay

### Sector del Vainillo (19 recintos)
El Capullo · La Delicia km 50 · Km 48 · San Mauricio · Pedro J. Moreno · 26 de Mayo ·
Miranda Girón 1 · Miranda Girón 2 · El Martillo · Río Ruidoso · Tres Cerritos · Las Palmas 1 ·
Las Palmas 2 · Payo Chico · La Vega 2 · El Manguito · La Línea · Puente Roto · Santa Sofía

### Sector vía a Bucay (11 recintos)
Los Naranjos · Cooperativa 1 de Septiembre · El Guabito · Los Ángeles · El Achiote · La Matilde ·
La Doraliza · Chanchán · Santa Martha · San Joaquín · Casa Blanca

### Recintos adicionales (directorio escolar / OSM)
La Fortuna · La Gloria · Río Guayas · El Vainillo · Dos Bocas · Hacienda Nilo · Río Blanco ·
San Juan · La Tola · La Violeta · Puente Negro · Crucita · La Veinte Mil · Cooperativa 3 Reyes ·
Cooperativa Payo · Payo · Pretoria · Barranco Alto · La Zulema Guabo · Santa Marianita ·
Estero La Leona · Las Vegas 2

### ⚠️ El Piedrero — zona en disputa
~300 km² y ~3.500 habitantes **reclamados por El Triunfo (Guayas) y La Troncal (Cañar)**. Tiene dos subcentros de salud, uno por cada cantón. Relevante para el negocio: si se vende también a La Troncal, un pedido de El Piedrero puede aparecer en ambas plataformas y la competencia sobre la obra es ambigua. Marcarlo explícitamente.

---

## 5. Población (Censo INEC 2022)

| Dato | Valor |
|---|---|
| Cantón | 60.541 hab. |
| Área urbana (cabecera) | 41.042 hab. |
| Área rural | 19.499 hab. |
| Hombres / Mujeres | 29.737 / 30.804 |
| 0–14 años | 18.471 |

Serie: 1990: 25.284 → 2001: 34.117 → 2010: 44.778 → 2022: 60.541.

Wikipedia ES muestra 50.060 (proyección, no censo). **Usar 60.541 / 41.042.**

Sirve para calcular el "% de vecinos de la ciudadela que apoyan" del panel.

---

## 6. Categorías de obra — ordenadas por déficit real documentado

1. **Alcantarillado pluvial / inundaciones** — 76,44 % de las ciudadelas SIN servicio. El problema más citado en el PDOT.
2. **Alcantarillado sanitario** — cobertura urbana ~64 % (déficit 36 %), rural ~1 %.
3. **Vialidad urbana (adoquinado / asfalto)** — 80,39 % del viario urbano es lastre.
4. **Agua potable** — urbano ~94 %, rural 7 % de red pública; calidad deficiente en recintos.
5. **Aceras y bordillos**
6. **Recolección de basura** — botadero a cielo abierto en El Achiote; la recolección solo llega por vías pavimentadas.
7. **Parques, áreas verdes y canchas**
8. **Alumbrado público**
9. **Vialidad rural y puentes** — competencia de la Prefectura, no del municipio. Distinguir en la app.

### Ciudadelas SIN alcantarillado pluvial (PDOT)
Nueva Jerusalén · Agua Santa 1-2 · Santa Marianita · Aníbal Zea 1-2 · Aníbal Zea Empleados ·
Triunfo 87 · Huancavilca · San Pedro 1-2-3 · Santa Zoila · Che Guevara · Jaime Roldós ·
Río Verde · Divino Niño · San Jacinto 1-2 · Centro Poblado Río Verde · Patria Nueva A-C · La Paz ·
Nuevo Amanecer 1-2

### Ciudadelas CON alcantarillado pluvial
Abdón Calderón · Assad Bucaram · La Carmela 1 · Velasco Ibarra · Guayaquil · 12 de Agosto ·
La Victoria · San José · Yaguachi · Bellavista · El Paraíso · Pedro Menéndez A-B · Blanca Coello

### Dato clave de secuencia técnica
Cita literal del PDOT: *"La carencia del servicio [pluvial] impide poder continuar con los trabajos de mejoramiento vial ya sea este de adoquinamiento o pavimento flexible."*

Es decir: **drenaje primero, capa de rodadura después.** Un pedido de "pavimentar" en una ciudadela sin pluvial es técnicamente inviable hasta que se haga el drenaje. Vale la pena que el panel lo advierta al equipo — es el tipo de detalle que hace ver competente al candidato.

---

## 7. Contexto político actual

- Alcaldesa: **Mabel Tenezaca López**.
- Alcalde del período 2019–2023: Dr. José David Martillo Pino (autor del PDOT y del Plan de Trabajo citados).
- El sitio municipal `el-triunfo.gob.ec` tiene la sección de noticias sin actualizar desde 2019 — señal de oportunidad para vender presencia digital.

## 8. Recomendación de carga

1. Cargar el bloque 1 (documento municipal) como catálogo base con `verificado: true`.
2. Cargar el bloque 2 (OSM) con `verificado: false`, visible pero marcado.
3. Dejar que los vecinos propongan sectores faltantes desde la app — es la vía más rápida de completar el catálogo con conocimiento local, que ninguna fuente publicada tiene.
