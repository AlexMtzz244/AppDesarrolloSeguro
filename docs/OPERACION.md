# Operación y respuesta a incidentes

> **Estado: propuesta base, no aprobada ni ensayada** (decisión D-11).
>
> SC-LAB-003 §6 insiste en que este documento debe existir **antes** de
> necesitarlo: el día del incidente no hay tiempo de decidir quién decide.

---

## 1. SLA de remediación por severidad

Acordados de antemano, precisamente para no tener que discutirlos cuando no
haya tiempo. SC-LAB-003 §6 lo formula así: *"Evitar la discusión sobre si
conviene parchar ahora, justo cuando no hay tiempo para discutirlo. La decisión
ya está tomada."*

| Severidad | Tiempo máximo de remediación | Quién decide desplegar |
|---|---|---|
| **Crítica** | 72 horas | Seguridad informática, sin esperar ventana |
| **Alta** | 7 días naturales | Seguridad informática |
| **Media** | 30 días | Equipo de desarrollo, en el sprint |
| **Baja** | Siguiente ciclo de mantenimiento | Equipo de desarrollo |

El reloj corre **desde que el CVE es público**, no desde que abrimos el issue.
Es la distinción de SC-LAB-003 §4 caso C: el daño no fueron los 8 meses hasta
que apareció la vulnerabilidad, sino los **2 meses hasta detectarla**.

`.github/workflows/cve-scan.yml` corre a diario y abre el issue
automáticamente. Sin ese disparador, "vigilancia continua" es una intención, no
un control.

---

## 2. Procedimiento de respuesta a incidentes

### 2.1 Roles

| Rol | Responsabilidad |
|---|---|
| **Coordinador** | Decide, mantiene la bitácora del incidente, comunica |
| **Técnico** | Contiene, investiga, remedia |
| **Comunicación** | Notifica a afectados y a dirección |
| **Jurídico** | Determina obligaciones de notificación (D-09) |

*(Falta designar personas concretas — D-11.)*

### 2.2 Fases

**1. Detección.** Por alerta automática, reporte de usuario o hallazgo externo.
Se abre bitácora del incidente con fecha, hora y quién detectó.

**2. Contención.** Objetivo: detener el daño en curso sin destruir evidencia.

| Situación | Acción inmediata |
|---|---|
| Cuenta comprometida | Desactivar el usuario (revoca todas sus sesiones) |
| Secreto expuesto | **Rotar primero**, limpiar el historial después |
| Dependencia explotada | Parchear o aislar el componente |
| Exfiltración en curso | Revocar sesiones del actor y bloquear el origen |

> **No borrar registros ni "limpiar" la base durante la contención.** La
> bitácora es append-only precisamente para que esto no sea posible, ni
> siquiera con buena intención.

**3. Investigación.** Consultar la auditoría por `correlationId`, actor y
ventana temporal. Reconstruir la secuencia. Determinar **alcance**: qué datos,
de quién, durante cuánto tiempo.

Si la trazabilidad no alcanza para descartar el compromiso, **se asume
compromiso**. SC-LAB-003 §4 caso C: *"si no hay trazabilidad suficiente, no
poder descartarlo... esa duda es el daño real y no se corrige actualizando."*

**4. Remediación.** Corregir la causa raíz, no el síntoma. Si el defecto se
originó en un requisito ambiguo, **corregir el requisito** — si no, la
siguiente historia que dependa de él vuelve a producir el mismo hueco
(SC-LAB-003 §2.2).

**5. Notificación.** Jurídico determina las obligaciones. Los titulares
afectados se notifican por un canal independiente del sistema comprometido.

**6. Cierre.** Post mortem **sin señalar culpables**: se busca la falla del
proceso, no de la persona. Un post mortem punitivo garantiza que el siguiente
incidente se reporte tarde o no se reporte.

### 2.3 Caso especial: secreto expuesto en el repositorio

SC-LAB-002 escenario B es explícito y merece repetirse, porque el orden
importa:

1. **ROTAR EL SECRETO.** Es lo primero y es lo único que cierra el problema.
2. Revisar el uso del secreto comprometido en los registros del proveedor.
3. Limpiar el historial (`git filter-repo` o BFG) — **higiene posterior**.
4. Avisar al equipo para que rehagan sus clones.

> Si el token llegó a un repositorio remoto, se debe asumir comprometido.
> Reescribir el historial **no** lo borra de los clones que otros ya tienen, ni
> de los forks, ni de las cachés del proveedor, ni de los bots que escanean
> GitHub en tiempo real.

---

## 3. Respaldos

| Qué | Frecuencia | Retención | Restauración probada |
|---|---|---|---|
| Base operacional | Diaria completa + WAL continuo | 30 días | Mensual |
| `evento_auditoria` | Diaria | **Mínimo un semestre** (D-09) | Trimestral |
| Documentos (S3) | Versionado + replicación | Según D-09 | Trimestral |

**La restauración se prueba o no existe.** Un respaldo que nunca se restauró es
una suposición, no un control.

La retención mínima de la bitácora es de un semestre porque el fraude del
escenario 5 de SC-LAB-001 se detecta tarde por naturaleza: si el respaldo solo
cubre 30 días, la evidencia del periodo anterior ya no está.

---

## 4. Sincronización horaria

**Todos los servidores con NTP activo y sincronizado.**

No es un detalle de configuración. SC-LAB-002 escenario C lo incluye en la fase
de Despliegue: *"Sincronización horaria de los servidores, sin la cual las
marcas de tiempo de la bitácora no son defendibles."*

Una bitácora con relojes desfasados no permite establecer el orden de los
hechos, y el orden es justamente lo que se necesita para reconstruir el paso
intermedio del escenario 5.

Todas las marcas se almacenan en `timestamptz` (UTC).

---

## 5. Revisión periódica

Estas actividades son las que convierten los registros en controles. Como dice
SC-LAB-002 escenario E: **una bitácora que nadie revisa no es un control, es un
archivo.**

| Actividad | Frecuencia | Responsable |
|---|---|---|
| Revisar alertas pendientes | Diaria | Seguridad informática |
| Revisar bitácora de correcciones de calificaciones | Semanal | Dirección académica |
| Revisar bitácora de asignaciones contra el calendario | Semanal | Dirección académica |
| Revisar asignaciones de rol vencidas o por revisar | Mensual | Seguridad informática |
| Revisar la matriz rol–permiso completa | Semestral (D-08) | Académica + Seguridad |
| Probar restauración de respaldos | Mensual / trimestral | Dirección de TI |
| Revisar este documento | Semestral | Todos |

---

## 6. Separación de ambientes

| Ambiente | Datos | Credenciales | Semillas |
|---|---|---|---|
| Desarrollo | Sintéticos | Propias, en `.env` local | Sí |
| Pruebas / CI | Efímeros | Propias, generadas por ejecución | Sí |
| Producción | Reales | Gestor de secretos, **nunca** en el repositorio | **Rechazadas al arrancar** |

Cada ambiente usa credenciales distintas (RNFS-057). Las credenciales de
desarrollo están documentadas en el README y el arranque en producción con
`PERMITIR_DATOS_SEMILLA=true` **falla ruidosamente** (RNFS-058).

---

## 7. Endurecimiento de producción — lista de verificación

Antes de cualquier despliegue productivo:

- [ ] `NODE_ENV=production`
- [ ] `SESION_COOKIE_SECURE=true` *(la validación de entorno lo exige)*
- [ ] `PERMITIR_DATOS_SEMILLA=false` *(la validación de entorno lo exige)*
- [ ] `CAPTCHA_PROVEEDOR` distinto de `ninguno` *(la validación lo exige)*
- [ ] `CORS_ORIGENES_PERMITIDOS` solo con orígenes `https://` *(la validación lo exige)*
- [ ] `TRUST_PROXY_SALTOS` ajustado al número real de proxies
- [ ] HTTPS con HSTS en el borde
- [ ] Rate limiting **también** en el WAF o proxy inverso
- [ ] OpenAPI **no** expuesto (se desactiva solo en producción)
- [ ] Rol de aplicación sin `UPDATE`/`DELETE` sobre `evento_auditoria` — verificar
- [ ] Buckets de S3 sin acceso anónimo — verificar
- [ ] NTP activo en todos los servidores
- [ ] Respaldo restaurado con éxito al menos una vez
- [ ] Las decisiones D-06, D-07 y D-10 aprobadas

Las cinco primeras las comprueba la propia aplicación al arrancar y **se niega
a iniciar** si no se cumplen. El resto requiere verificación manual.
