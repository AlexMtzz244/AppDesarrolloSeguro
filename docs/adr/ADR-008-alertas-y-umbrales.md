# ADR-008 — Modelo de alertas y umbrales parametrizables

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 21 de septiembre de 2026 |
| **Requisitos** | RF-090, RF-091 |
| **Origen** | SC-LAB-001 escenario 5 · SC-LAB-002 escenario E · SC-LAB-003 §7.1 |

## Contexto

Es la ADR que justifica por qué un sistema con un modelo de autorización
cuidado necesita además controles detectivos.

SC-LAB-003 §7.1 enumera las categorías de riesgo que **solo son observables en
operación**: el abuso de un usuario legítimamente autorizado, los ataques en
curso, los permisos que se acumulan, la erosión del entorno. Ninguna se
descubre analizando el código, porque en ninguna hay código defectuoso.

Y SC-LAB-002 escenario E concluye que para la asignación docente el control
**principal** es detectivo, no preventivo — la excepción a todo el resto del
mapa.

## Decisión

Siete reglas, evaluadas periódicamente sobre la bitácora. Dos merecen
explicación aparte.

| Regla | Ventana | Severidad | Qué detecta |
|---|---|---|---|
| `rafaga-403` | 5 min | alta | Enumeración de identificadores |
| `descargas-masivas` | 1 h | alta | Exfiltración por cuenta autorizada |
| `acceso-inusual` | inmediata | — | Dispositivo o red no habitual |
| `correcciones-anormales` | 24 h | alta | La corrección usada como vía ordinaria |
| `cambio-privilegio` | 10 min | **crítica** | Todo cambio del modelo de autorización |
| `captura-inmediata-tras-asignacion` | configurable | media | Escenario 5, primera mitad |
| `asignacion-revertida-pronto` | configurable | alta | Escenario 5, segunda mitad |

### Las dos últimas son el control principal del escenario 5

`asignacion-revertida-pronto` es el único control que ve el paso intermedio del
ataque, porque después de revertir el sistema queda en un estado final
perfectamente consistente. Una asignación docente que dura minutos no tiene
explicación académica ordinaria.

Y **solo es posible porque la asignación se versiona** (ADR-006). Con un campo
`profesorId` actualizable, esta consulta no tendría nada que mirar.

### `cambio-privilegio` no tiene umbral

Uno solo basta. No existe un número "normal" de cambios de rol a partir del
cual empiece a preocupar: SC-LAB-001 escenario 4 describe el impacto de un
cambio no autorizado como control total del sistema.

### Por qué periódicas y no por evento

Los patrones son temporales: "capturó *en la hora siguiente* a ser asignado",
"revirtió *poco después* de crear". Ninguno se puede evaluar en el instante del
primer evento, porque el segundo todavía no existe.

### Idempotencia

Cada alerta lleva `claveIdempotencia` única, derivada del recurso y la ventana
temporal. Reevaluar la misma ventana no duplica alertas, y una alerta duplicada
es peor que inútil: entrena al operador a ignorarlas.

## Consecuencias

**Los umbrales son configurables (D-05)** y los valores por defecto están sin
calibrar contra tráfico real. Un umbral mal puesto produce ruido, y el ruido
lleva a desactivar la alerta, que es la forma habitual en que estos controles
mueren.

**Esta ADR no cierra el control.** SC-LAB-002 escenario E: *"Una bitácora que
nadie revisa no es un control, es un archivo."* Las reglas automatizan la
detección; la revisión humana y el procedimiento de respuesta viven en
`docs/OPERACION.md` y siguen siendo indispensables.
