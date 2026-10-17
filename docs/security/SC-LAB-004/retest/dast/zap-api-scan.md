# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Informational | 3 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Medium | Exceeded High | http://host.docker.internal:3001 | Percentage of responses with status code 4xx | 99 % |
| Low | Warning |  | ZAP warnings logged - see the zap.log file for details | 8    |
| Info | Informational | http://host.docker.internal:3001 | Percentage of responses with status code 2xx | 8 % |
| Info | Informational | http://host.docker.internal:3001 | Percentage of endpoints with content type application/json | 100 % |
| Info | Informational | http://host.docker.internal:3001 | Percentage of endpoints with method DELETE | 1 % |
| Info | Informational | http://host.docker.internal:3001 | Percentage of endpoints with method GET | 68 % |
| Info | Informational | http://host.docker.internal:3001 | Percentage of endpoints with method PATCH | 3 % |
| Info | Informational | http://host.docker.internal:3001 | Percentage of endpoints with method POST | 27 % |
| Info | Informational | http://host.docker.internal:3001 | Count of total endpoints | 211    |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| A Client Error response code was returned by the server | Informational | 211 |
| Non-Storable Content | Informational | Systemic |
| Storable and Cacheable Content | Informational | 1 |




## Alert Detail



### [ A Client Error response code was returned by the server ](https://www.zaproxy.org/docs/alerts/100000/)



##### Informational (High)

### Description

A response code of 401 was returned by the server.
This may indicate that the application is failing to handle unexpected input correctly.
Raised by the 'Alert on HTTP Response Code Error' script

* URL: http://host.docker.internal:3001/api/auth/sesiones/id
  * Node Name: `http://host.docker.internal:3001/api/auth/sesiones/id`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/sesiones/id/
  * Node Name: `http://host.docker.internal:3001/api/auth/sesiones/id/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001
  * Node Name: `http://host.docker.internal:3001`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/
  * Node Name: `http://host.docker.internal:3001/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/3743394568626627382
  * Node Name: `http://host.docker.internal:3001/3743394568626627382`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api
  * Node Name: `http://host.docker.internal:3001/api`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/
  * Node Name: `http://host.docker.internal:3001/api/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/120878388722874362
  * Node Name: `http://host.docker.internal:3001/api/120878388722874362`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/alertas
  * Node Name: `http://host.docker.internal:3001/api/alertas`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/alertas/
  * Node Name: `http://host.docker.internal:3001/api/alertas/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auditoria
  * Node Name: `http://host.docker.internal:3001/api/auditoria`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auditoria/
  * Node Name: `http://host.docker.internal:3001/api/auditoria/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auditoria/7555166659830899274
  * Node Name: `http://host.docker.internal:3001/api/auditoria/7555166659830899274`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auditoria/exportar
  * Node Name: `http://host.docker.internal:3001/api/auditoria/exportar`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auditoria/exportar/
  * Node Name: `http://host.docker.internal:3001/api/auditoria/exportar/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/aulas
  * Node Name: `http://host.docker.internal:3001/api/aulas`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/aulas/
  * Node Name: `http://host.docker.internal:3001/api/aulas/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth
  * Node Name: `http://host.docker.internal:3001/api/auth`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/
  * Node Name: `http://host.docker.internal:3001/api/auth/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/261657763991138592
  * Node Name: `http://host.docker.internal:3001/api/auth/261657763991138592`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/contrasena
  * Node Name: `http://host.docker.internal:3001/api/auth/contrasena`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/contrasena/
  * Node Name: `http://host.docker.internal:3001/api/auth/contrasena/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/contrasena/8557753928912337642
  * Node Name: `http://host.docker.internal:3001/api/auth/contrasena/8557753928912337642`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/contrasena/actuator/health
  * Node Name: `http://host.docker.internal:3001/api/auth/contrasena/actuator/health`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/mfa
  * Node Name: `http://host.docker.internal:3001/api/auth/mfa`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/mfa/
  * Node Name: `http://host.docker.internal:3001/api/auth/mfa/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/mfa/7278951408092201164
  * Node Name: `http://host.docker.internal:3001/api/auth/mfa/7278951408092201164`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/recuperacion
  * Node Name: `http://host.docker.internal:3001/api/auth/recuperacion`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/recuperacion/
  * Node Name: `http://host.docker.internal:3001/api/auth/recuperacion/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/recuperacion/3898506352006114257
  * Node Name: `http://host.docker.internal:3001/api/auth/recuperacion/3898506352006114257`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/sesiones
  * Node Name: `http://host.docker.internal:3001/api/auth/sesiones`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/sesiones/
  * Node Name: `http://host.docker.internal:3001/api/auth/sesiones/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/sesiones/1899044575197223264
  * Node Name: `http://host.docker.internal:3001/api/auth/sesiones/1899044575197223264`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/yo
  * Node Name: `http://host.docker.internal:3001/api/auth/yo`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/yo/
  * Node Name: `http://host.docker.internal:3001/api/auth/yo/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones
  * Node Name: `http://host.docker.internal:3001/api/calificaciones`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/8998593722238763857
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/8998593722238763857`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/corregibles
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/corregibles`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/corregibles/
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/corregibles/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/grupo
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/grupo`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/grupo/
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/grupo/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/grupo/1874513342094763967
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/grupo/1874513342094763967`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/grupo/%257BgrupoId%257D
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/grupo/{grupoId}`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/grupo/%257BgrupoId%257D/
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/grupo/{grupoId}/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/id
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/id/
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/id/7844631124136605636
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/id/7844631124136605636`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/mias
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/mias`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/mias/
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/mias/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/%257Bid%257D
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/{id}`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/%257Bid%257D/
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/{id}/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/%257Bid%257D/8075699550785034942
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/{id}/8075699550785034942`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/%257Bid%257D/historial
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/{id}/historial`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/%257Bid%257D/historial/
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/{id}/historial/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/decisiones
  * Node Name: `http://host.docker.internal:3001/api/decisiones`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/decisiones/
  * Node Name: `http://host.docker.internal:3001/api/decisiones/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/decisiones/6636037225147957412
  * Node Name: `http://host.docker.internal:3001/api/decisiones/6636037225147957412`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/decisiones/id
  * Node Name: `http://host.docker.internal:3001/api/decisiones/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/decisiones/id/
  * Node Name: `http://host.docker.internal:3001/api/decisiones/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/decisiones/id/5588482607576892069
  * Node Name: `http://host.docker.internal:3001/api/decisiones/id/5588482607576892069`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos
  * Node Name: `http://host.docker.internal:3001/api/documentos`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos/
  * Node Name: `http://host.docker.internal:3001/api/documentos/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos/927100241167557444
  * Node Name: `http://host.docker.internal:3001/api/documentos/927100241167557444`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos/cuota
  * Node Name: `http://host.docker.internal:3001/api/documentos/cuota`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos/cuota/
  * Node Name: `http://host.docker.internal:3001/api/documentos/cuota/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos/id
  * Node Name: `http://host.docker.internal:3001/api/documentos/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos/id/
  * Node Name: `http://host.docker.internal:3001/api/documentos/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos/id/3890878668262455213
  * Node Name: `http://host.docker.internal:3001/api/documentos/id/3890878668262455213`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos/id/descargar
  * Node Name: `http://host.docker.internal:3001/api/documentos/id/descargar`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos/id/descargar/
  * Node Name: `http://host.docker.internal:3001/api/documentos/id/descargar/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos/mios
  * Node Name: `http://host.docker.internal:3001/api/documentos/mios`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos/mios/
  * Node Name: `http://host.docker.internal:3001/api/documentos/mios/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos/tipos
  * Node Name: `http://host.docker.internal:3001/api/documentos/tipos`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos/tipos/
  * Node Name: `http://host.docker.internal:3001/api/documentos/tipos/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/estudiantes
  * Node Name: `http://host.docker.internal:3001/api/estudiantes`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/estudiantes/
  * Node Name: `http://host.docker.internal:3001/api/estudiantes/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos
  * Node Name: `http://host.docker.internal:3001/api/grupos`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos%3Fperiodo=periodo
  * Node Name: `http://host.docker.internal:3001/api/grupos (periodo)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/
  * Node Name: `http://host.docker.internal:3001/api/grupos/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/8970275029672967090
  * Node Name: `http://host.docker.internal:3001/api/grupos/8970275029672967090`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/id
  * Node Name: `http://host.docker.internal:3001/api/grupos/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/id/
  * Node Name: `http://host.docker.internal:3001/api/grupos/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/id/4611524888601255581
  * Node Name: `http://host.docker.internal:3001/api/grupos/id/4611524888601255581`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/id/asignaciones
  * Node Name: `http://host.docker.internal:3001/api/grupos/id/asignaciones`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/id/asignaciones/
  * Node Name: `http://host.docker.internal:3001/api/grupos/id/asignaciones/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/4842339909430258804
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/4842339909430258804`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/asignaciones
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/asignaciones`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/asignaciones/
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/asignaciones/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/asignaciones/3406132114767713900
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/asignaciones/3406132114767713900`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/inscripciones
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/inscripciones`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/inscripciones/
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/inscripciones/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/inscripciones/331800456282239039
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/inscripciones/331800456282239039`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/inscripciones/inscripcionId
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/inscripciones/inscripcionId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/inscripciones/inscripcionId/
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/inscripciones/inscripcionId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/inscripciones/inscripcionId/6115109736152232075
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/inscripciones/inscripcionId/6115109736152232075`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/materias
  * Node Name: `http://host.docker.internal:3001/api/materias`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/materias/
  * Node Name: `http://host.docker.internal:3001/api/materias/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/perfiles
  * Node Name: `http://host.docker.internal:3001/api/perfiles`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/perfiles/
  * Node Name: `http://host.docker.internal:3001/api/perfiles/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/perfiles/3826148242892583069
  * Node Name: `http://host.docker.internal:3001/api/perfiles/3826148242892583069`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/perfiles/id
  * Node Name: `http://host.docker.internal:3001/api/perfiles/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/perfiles/id/
  * Node Name: `http://host.docker.internal:3001/api/perfiles/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/periodos
  * Node Name: `http://host.docker.internal:3001/api/periodos`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/periodos/
  * Node Name: `http://host.docker.internal:3001/api/periodos/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/periodos/3082125007734391091
  * Node Name: `http://host.docker.internal:3001/api/periodos/3082125007734391091`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/periodos/id
  * Node Name: `http://host.docker.internal:3001/api/periodos/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/periodos/id/
  * Node Name: `http://host.docker.internal:3001/api/periodos/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/periodos/id/7950169182542409881
  * Node Name: `http://host.docker.internal:3001/api/periodos/id/7950169182542409881`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/periodos/id/autorizaciones
  * Node Name: `http://host.docker.internal:3001/api/periodos/id/autorizaciones`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/periodos/id/autorizaciones/
  * Node Name: `http://host.docker.internal:3001/api/periodos/id/autorizaciones/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/profesores
  * Node Name: `http://host.docker.internal:3001/api/profesores`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/profesores/
  * Node Name: `http://host.docker.internal:3001/api/profesores/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/programas
  * Node Name: `http://host.docker.internal:3001/api/programas`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/programas/
  * Node Name: `http://host.docker.internal:3001/api/programas/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/programas/5402706755287328073
  * Node Name: `http://host.docker.internal:3001/api/programas/5402706755287328073`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/programas/mio
  * Node Name: `http://host.docker.internal:3001/api/programas/mio`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/programas/mio/
  * Node Name: `http://host.docker.internal:3001/api/programas/mio/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes
  * Node Name: `http://host.docker.internal:3001/api/solicitudes`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/968270642485548937
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/968270642485548937`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/bandeja
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/bandeja`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/bandeja/
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/bandeja/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/catalogo
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/catalogo`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/catalogo/
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/catalogo/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/id
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/id/
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/id/7035844802981545368
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/id/7035844802981545368`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/mias
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/mias`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/mias/
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/mias/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/%257Bid%257D
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/{id}`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/%257Bid%257D/
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/{id}/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios
  * Node Name: `http://host.docker.internal:3001/api/usuarios`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/
  * Node Name: `http://host.docker.internal:3001/api/usuarios/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/3003965448303126370
  * Node Name: `http://host.docker.internal:3001/api/usuarios/3003965448303126370`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/id
  * Node Name: `http://host.docker.internal:3001/api/usuarios/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/id/
  * Node Name: `http://host.docker.internal:3001/api/usuarios/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/id/8028946737083498864
  * Node Name: `http://host.docker.internal:3001/api/usuarios/id/8028946737083498864`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/roles
  * Node Name: `http://host.docker.internal:3001/api/usuarios/roles`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/roles/
  * Node Name: `http://host.docker.internal:3001/api/usuarios/roles/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/roles/8073063263814852273
  * Node Name: `http://host.docker.internal:3001/api/usuarios/roles/8073063263814852273`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/roles/asignacionId
  * Node Name: `http://host.docker.internal:3001/api/usuarios/roles/asignacionId`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/roles/asignacionId/
  * Node Name: `http://host.docker.internal:3001/api/usuarios/roles/asignacionId/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/roles/asignacionId/3971714641643566757
  * Node Name: `http://host.docker.internal:3001/api/usuarios/roles/asignacionId/3971714641643566757`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/perfiles/id
  * Node Name: `http://host.docker.internal:3001/api/perfiles/id`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/perfiles/id/
  * Node Name: `http://host.docker.internal:3001/api/perfiles/id/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/id/estado
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/id/estado`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/id/estado/
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/id/estado/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/id/estado
  * Node Name: `http://host.docker.internal:3001/api/usuarios/id/estado`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/id/estado/
  * Node Name: `http://host.docker.internal:3001/api/usuarios/id/estado/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/roles/asignacionId/revocar
  * Node Name: `http://host.docker.internal:3001/api/usuarios/roles/asignacionId/revocar`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/roles/asignacionId/revocar/
  * Node Name: `http://host.docker.internal:3001/api/usuarios/roles/asignacionId/revocar/`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/contrasena/cambiar
  * Node Name: `http://host.docker.internal:3001/api/auth/contrasena/cambiar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/contrasena/cambiar/
  * Node Name: `http://host.docker.internal:3001/api/auth/contrasena/cambiar/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/login
  * Node Name: `http://host.docker.internal:3001/api/auth/login`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/login/
  * Node Name: `http://host.docker.internal:3001/api/auth/login/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/logout
  * Node Name: `http://host.docker.internal:3001/api/auth/logout`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/logout/
  * Node Name: `http://host.docker.internal:3001/api/auth/logout/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/mfa/confirmar
  * Node Name: `http://host.docker.internal:3001/api/auth/mfa/confirmar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/mfa/confirmar/
  * Node Name: `http://host.docker.internal:3001/api/auth/mfa/confirmar/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/mfa/iniciar
  * Node Name: `http://host.docker.internal:3001/api/auth/mfa/iniciar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/mfa/iniciar/
  * Node Name: `http://host.docker.internal:3001/api/auth/mfa/iniciar/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/mfa/verificar
  * Node Name: `http://host.docker.internal:3001/api/auth/mfa/verificar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/mfa/verificar/
  * Node Name: `http://host.docker.internal:3001/api/auth/mfa/verificar/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/recuperacion/completar
  * Node Name: `http://host.docker.internal:3001/api/auth/recuperacion/completar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/recuperacion/completar/
  * Node Name: `http://host.docker.internal:3001/api/auth/recuperacion/completar/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/recuperacion/solicitar
  * Node Name: `http://host.docker.internal:3001/api/auth/recuperacion/solicitar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/recuperacion/solicitar/
  * Node Name: `http://host.docker.internal:3001/api/auth/recuperacion/solicitar/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/captura
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/captura`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/captura/
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/captura/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/id/corregir
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/id/corregir`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/id/corregir/
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/id/corregir/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/publicar
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/publicar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/calificaciones/publicar/
  * Node Name: `http://host.docker.internal:3001/api/calificaciones/publicar/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/decisiones/id/aprobar
  * Node Name: `http://host.docker.internal:3001/api/decisiones/id/aprobar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/decisiones/id/aprobar/
  * Node Name: `http://host.docker.internal:3001/api/decisiones/id/aprobar/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos%3Ftipo=tipo&titular=titular
  * Node Name: `http://host.docker.internal:3001/api/documentos (tipo,titular)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/documentos/
  * Node Name: `http://host.docker.internal:3001/api/documentos/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos
  * Node Name: `http://host.docker.internal:3001/api/grupos`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/
  * Node Name: `http://host.docker.internal:3001/api/grupos/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/asignaciones
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/asignaciones`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/asignaciones/
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/asignaciones/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/asignaciones/cerrar
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/asignaciones/cerrar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/asignaciones/cerrar/
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/asignaciones/cerrar/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/inscripciones
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/inscripciones`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/inscripciones/
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/inscripciones/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/inscripciones/inscripcionId/baja
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/inscripciones/inscripcionId/baja`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/grupos/%257Bid%257D/inscripciones/inscripcionId/baja/
  * Node Name: `http://host.docker.internal:3001/api/grupos/{id}/inscripciones/inscripcionId/baja/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/periodos
  * Node Name: `http://host.docker.internal:3001/api/periodos`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/periodos/
  * Node Name: `http://host.docker.internal:3001/api/periodos/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/periodos/id/autorizaciones
  * Node Name: `http://host.docker.internal:3001/api/periodos/id/autorizaciones`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/periodos/id/autorizaciones/
  * Node Name: `http://host.docker.internal:3001/api/periodos/id/autorizaciones/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/periodos/id/cerrar
  * Node Name: `http://host.docker.internal:3001/api/periodos/id/cerrar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/periodos/id/cerrar/
  * Node Name: `http://host.docker.internal:3001/api/periodos/id/cerrar/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes
  * Node Name: `http://host.docker.internal:3001/api/solicitudes`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/solicitudes/
  * Node Name: `http://host.docker.internal:3001/api/solicitudes/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios
  * Node Name: `http://host.docker.internal:3001/api/usuarios`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/
  * Node Name: `http://host.docker.internal:3001/api/usuarios/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/id/desbloquear
  * Node Name: `http://host.docker.internal:3001/api/usuarios/id/desbloquear`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/id/desbloquear/
  * Node Name: `http://host.docker.internal:3001/api/usuarios/id/desbloquear/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/id/roles
  * Node Name: `http://host.docker.internal:3001/api/usuarios/id/roles`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/usuarios/id/roles/
  * Node Name: `http://host.docker.internal:3001/api/usuarios/id/roles/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/computeMetadata/v1/
  * Node Name: `http://host.docker.internal:3001/computeMetadata/v1/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/latest/meta-data/
  * Node Name: `http://host.docker.internal:3001/latest/meta-data/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/metadata/instance
  * Node Name: `http://host.docker.internal:3001/metadata/instance`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/metadata/v1
  * Node Name: `http://host.docker.internal:3001/metadata/v1`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/opc/v1/instance/
  * Node Name: `http://host.docker.internal:3001/opc/v1/instance/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/opc/v2/instance/
  * Node Name: `http://host.docker.internal:3001/opc/v2/instance/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:3001/openstack/latest/meta_data.json
  * Node Name: `http://host.docker.internal:3001/openstack/latest/meta_data.json`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``


Instances: 211

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

### [ Non-Storable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are not storable by caching components such as proxy servers. If the response does not contain sensitive, personal or user-specific information, it may benefit from being stored and cached, to improve performance.

* URL: http://host.docker.internal:3001/api/auth/sesiones/id
  * Node Name: `http://host.docker.internal:3001/api/auth/sesiones/id`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `DELETE `
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auditoria/exportar
  * Node Name: `http://host.docker.internal:3001/api/auditoria/exportar`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/auth/sesiones
  * Node Name: `http://host.docker.internal:3001/api/auth/sesiones`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/decisiones
  * Node Name: `http://host.docker.internal:3001/api/decisiones`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:3001/api/decisiones/id/aprobar
  * Node Name: `http://host.docker.internal:3001/api/decisiones/id/aprobar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``

Instances: Systemic


### Solution

The content may be marked as storable by ensuring that the following conditions are satisfied:
The request method must be understood by the cache and defined as being cacheable ("GET", "HEAD", and "POST" are currently defined as cacheable)
The response status code must be understood by the cache (one of the 1XX, 2XX, 3XX, 4XX, or 5XX response classes are generally understood)
The "no-store" cache directive must not appear in the request or response header fields
For caching by "shared" caches such as "proxy" caches, the "private" response directive must not appear in the response
For caching by "shared" caches such as "proxy" caches, the "Authorization" header field must not appear in the request, unless the response explicitly allows it (using one of the "must-revalidate", "public", or "s-maxage" Cache-Control response directives)
In addition to the conditions above, at least one of the following conditions must also be satisfied by the response:
It must contain an "Expires" header field
It must contain a "max-age" response directive
For "shared" caches such as "proxy" caches, it must contain a "s-maxage" response directive
It must contain a "Cache Control Extension" that allows it to be cached
It must have a status code that is defined as cacheable by default (200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501).

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3

### [ Storable and Cacheable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are storable by caching components such as proxy servers, and may be retrieved directly from the cache, rather than from the origin server by the caching servers, in response to similar requests from other users. If the response data is sensitive, personal or user-specific, this may result in sensitive information being leaked. In some cases, this may even result in a user gaining complete control of the session of another user, depending on the configuration of the caching components in use in their environment. This is primarily an issue where "shared" caching servers such as "proxy" caches are configured on the local network. This configuration is typically found in corporate or educational environments, for instance.

* URL: http://host.docker.internal:3001/api/docs-json
  * Node Name: `http://host.docker.internal:3001/api/docs-json`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`


Instances: 1

### Solution

Validate that the response does not contain sensitive, personal or user-specific information. If it does, consider the use of the following HTTP response headers, to limit, or prevent the content being stored and retrieved from the cache by another user:
Cache-Control: no-cache, no-store, must-revalidate, private
Pragma: no-cache
Expires: 0
This configuration directs both HTTP 1.0 and HTTP 1.1 compliant caching servers to not store the response, and to not retrieve the response (without validation) from the cache, in response to a similar request.

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3


