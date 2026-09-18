# Cotizador inteligente para ferretería

**Propuesta de prueba (MVP)**  
WhatsApp + panel de aprobación · Sin costo de API de WhatsApp en la fase piloto

---

## 1. El problema

Hoy muchas cotizaciones llegan por WhatsApp: listas de materiales, audios y fotos. Atenderlas a mano implica:

- Buscar precios uno por uno  
- Calcular descuentos por volumen  
- Responder mientras se atiende el mostrador  
- Perder mensajes cuando el volumen sube  

**Resultado:** tiempo perdido, respuestas tardías y ventas que se escapan.

---

## 2. La solución (fase piloto)

Un **panel web simple** donde:

1. Se **copia y pega** el mensaje del cliente desde WhatsApp.  
2. La **IA arma un borrador** de cotización cruzando el pedido con el catálogo.  
3. El ferretero **revisa, ajusta y aprueba** en segundos.  
4. Se **copia la respuesta** (o PDF) y se envía en el mismo chat.

> El cliente no descarga ninguna app. Sigue escribiendo por WhatsApp como siempre.  
> En esta fase se usa **WhatsApp Business App (gratis)**. No se requiere WhatsApp API todavía.

---

## 3. Ventajas para la ferretería

| Beneficio | Qué significa en la práctica |
|-----------|------------------------------|
| **Más rapidez** | Cotizar en segundos, no en varios minutos |
| **Menos mensajes sin responder** | El borrador llega armado; solo hay que aprobar |
| **Menos errores** | Precios y descuentos salen del sistema, no de memoria |
| **Control total** | Nada se envía sin revisión humana |
| **Mejor atención** | Más tiempo para el mostrador y para clientes difíciles |
| **Historial claro** | Queda registro de lo cotizado, ganado o perdido |
| **Bajo riesgo de prueba** | Sin API de pago de WhatsApp; se valida con uso real |
| **Costo de IA muy bajo** | Modelos económicos; en volumen de una ferretería suele ser de centavos a pocos dólares al mes |

---

## 4. Cómo sería el flujo diario

```
Cliente escribe por WhatsApp
        ↓
Ferretero pega el mensaje en el panel
        ↓
IA + catálogo → borrador de cotización
        ↓
Ferretero revisa (✅ seguro · ⚠️ revisar · ❌ no encontrado)
        ↓
Ajusta si hace falta → Aprueba
        ↓
Copia texto / PDF → Pega en WhatsApp
        ↓
Cotización enviada (queda en el historial)
```

**Regla de oro del sistema:**  
*La IA propone · El catálogo cotiza · El ferretero aprueba.*

---

## 5. Qué vería en el panel

### Menú principal

- Nueva cotización  
- Historial  
- Catálogo  
- Precios y reglas  
- Clientes  

---

### 5.1 Nueva cotización *(pantalla principal)*

- Campo para **pegar el chat** del cliente  
- Botón **Armar borrador con IA**  
- Tipo de cliente: público / mayorista  
- Nombre o teléfono (opcional)  

**Ayuda:** deja de armar la cotización desde cero.

---

### 5.2 Revisión y aprobación

Tabla del borrador:

| Lo que pidió | Producto sugerido | Cantidad | Precio | Estado |
|--------------|-------------------|----------|--------|--------|
| tubo pvc 1/2 | Tubo PVC 1/2" x 3m | 2 | $… | ✅ |
| pegamento azul | Pegamento PVC 1/4 | 1 | $… | ⚠️ |
| “eso del lavamanos” | — | — | — | ❌ |

Acciones:

- Cambiar producto, cantidad o quitar ítems  
- Agregar productos manualmente  
- Ver total (USD / Bs con tasa del día)  
- **Aprobar y copiar para WhatsApp**  
- Descargar PDF (opcional)  

**Ayuda:** control de calidad en 20–40 segundos.

---

### 5.3 Catálogo

Por cada producto:

- Nombre comercial  
- **Alias** (cómo lo pide la gente: “tubo de media”, “pegamento azul”)  
- Unidad (und, m, kg, caja…)  
- Precio público / mayorista  
- Stock aproximado (opcional)  
- Activo / inactivo  

Extras: importar Excel, búsqueda rápida.

**Ayuda:** cuanto mejor el catálogo, mejor acierta la IA.

---

### 5.4 Precios y reglas

- Descuentos por cantidad (ej. ≥10 → 5%)  
- Listas: público vs mayorista  
- Tasa BCV editable  
- Vigencia de la cotización (24 / 48 / 72 h)  
- Texto de pie de cotización  

**Ayuda:** no recalcular descuentos a mano.

---

### 5.5 Historial

- Folio, cliente, total, fecha  
- Estados: borrador · enviada · ganada · perdida · vencida  
- Reabrir, duplicar o volver a copiar el texto  

**Ayuda:** no se pierde el hilo de lo cotizado.

---

### 5.6 Clientes frecuentes *(simple)*

- Nombre / WhatsApp  
- Tipo: público o mayorista  
- Notas breves  
- Últimas cotizaciones  

**Ayuda:** un clic aplica la lista de precios correcta.

---

## 6. Ejemplo de respuesta al cliente

```
Hola! Cotización #045 — Ferretería
Válida 48 horas

• Tubo PVC 1/2" x 3m     x2    $…
• Codo PVC 1/2"          x10   $…
• Pegamento PVC 1/4      x1    $…
--------------------------------
Subtotal: $…
Desc. volumen: $…
TOTAL: $…  (o Bs al BCV del día)

¿La apartamos o pasas a retirar?
```

---

## 7. Qué incluye la prueba y qué no

### Incluye (MVP)

- Pegar texto del chat  
- Borrador con IA  
- Aprobación humana  
- Catálogo + aliases  
- Reglas de descuento  
- Historial  
- Copia a WhatsApp  

### No incluye todavía

- Bot automático dentro de WhatsApp  
- WhatsApp API de pago  
- Lectura de audio/imagen *(se puede sumar después)*  
- Facturación electrónica completa  
- Inventario avanzado / compras a proveedores  

---

## 8. Plan de prueba sugerido

| Etapa | Qué hacemos |
|-------|-------------|
| **Preparación** | Cargar 150–300 productos de más rotación |
| **Semana 1** | Usar el panel en paralelo al método actual |
| **Semana 2** | Usar el panel para las cotizaciones de WhatsApp |
| **Medición** | Tiempo por cotización, mensajes respondidos, ventas cerradas |

### Señales de que vale la pena seguir

- Baja el tiempo por cotización  
- Se responden más chats  
- No se quiere volver al método anterior  
- Hay disposición a usar (y luego pagar) la herramienta de forma continua  

---

## 9. Evolución futura (si la prueba sale bien)

1. **Audio e imagen** → el panel también interpreta notas de voz y fotos de listas.  
2. **WhatsApp API** → el mensaje llega solo; llega notificación “cotización lista para aprobar”.  
3. **Más ferreterías** → mismo producto como servicio mensual (SaaS).  

---

## 10. Resumen en una frase

> Un asistente de cotización para WhatsApp: la IA arma el borrador, el ferretero aprueba, el cliente recibe rápido — y en la prueba inicial no hace falta pagar WhatsApp API.

---

## Próximo paso

Revisar esta propuesta y comentar:

1. ¿El flujo encaja con el día a día?  
2. ¿Qué les molesta más hoy: tiempo, errores o mensajes sin contestar?  
3. ¿Cuántas cotizaciones por WhatsApp llegan en un día típico?  
4. ¿Quieren probar con el catálogo real en una prueba piloto?

---

*Documento de propuesta — fase piloto · Uso interno*  
*Versión 1.0*
