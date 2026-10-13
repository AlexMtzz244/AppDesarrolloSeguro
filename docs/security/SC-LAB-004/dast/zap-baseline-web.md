# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 1 |
| Low | 6 |
| Informational | 4 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Low | Warning |  | ZAP errors logged - see the zap.log file for details | 2    |
| Low | Warning |  | ZAP warnings logged - see the zap.log file for details | 10    |
| Info | Informational | http://host.docker.internal:3000 | Percentage of responses with status code 2xx | 81 % |
| Info | Informational | http://host.docker.internal:3000 | Percentage of responses with status code 3xx | 12 % |
| Info | Informational | http://host.docker.internal:3000 | Percentage of responses with status code 4xx | 6 % |
| Info | Informational | http://host.docker.internal:3000 | Percentage of endpoints with content type application/javascript | 54 % |
| Info | Informational | http://host.docker.internal:3000 | Percentage of endpoints with content type text/css | 9 % |
| Info | Informational | http://host.docker.internal:3000 | Percentage of endpoints with content type text/html | 27 % |
| Info | Informational | http://host.docker.internal:3000 | Percentage of endpoints with content type text/plain | 9 % |
| Info | Informational | http://host.docker.internal:3000 | Percentage of endpoints with method GET | 100 % |
| Info | Informational | http://host.docker.internal:3000 | Count of total endpoints | 11    |
| Info | Informational | http://host.docker.internal:3000 | Percentage of slow responses | 93 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Content Security Policy (CSP) Header Not Set | Medium | 3 |
| Big Redirect Detected (Potential Sensitive Information Leak) | Low | 2 |
| Cross-Origin-Embedder-Policy Header Missing or Invalid | Low | 2 |
| Cross-Origin-Opener-Policy Header Missing or Invalid | Low | 2 |
| Cross-Origin-Resource-Policy Header Missing or Invalid | Low | Systemic |
| Dangerous JS Functions | Low | 4 |
| Private IP Disclosure | Low | 1 |
| Information Disclosure - Suspicious Comments | Informational | 10 |
| Modern Web Application | Informational | 2 |
| Non-Storable Content | Informational | Systemic |
| Storable but Non-Cacheable Content | Informational | 1 |




## Alert Detail



### [ Content Security Policy (CSP) Header Not Set ](https://www.zaproxy.org/docs/alerts/10038/)



##### Medium (High)

### Description

Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks, including Cross Site Scripting (XSS) and data injection attacks. These attacks are used for everything from data theft to site defacement or distribution of malware. CSP provides a set of standard HTTP headers that allow website owners to declare approved sources of content that browsers should be allowed to load on that page — covered types are JavaScript, CSS, HTML frames, fonts, images and embeddable objects such as Java applets, ActiveX, audio and video files.

* URL: http://host.docker.internal:3000
  * Node Name: `http://host.docker.internal:3000`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://host.docker.internal:3000/panel
  * Node Name: `http://host.docker.internal:3000/panel`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://host.docker.internal:3000/sitemap.xml
  * Node Name: `http://host.docker.internal:3000/sitemap.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 3

### Solution

Ensure that your web server, application server, load balancer, etc. is configured to set the Content-Security-Policy header.

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
* [ https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html ](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
* [ https://www.w3.org/TR/CSP/ ](https://www.w3.org/TR/CSP/)
* [ https://w3c.github.io/webappsec-csp/ ](https://w3c.github.io/webappsec-csp/)
* [ https://web.dev/articles/csp ](https://web.dev/articles/csp)
* [ https://caniuse.com/#feat=contentsecuritypolicy ](https://caniuse.com/#feat=contentsecuritypolicy)
* [ https://content-security-policy.com/ ](https://content-security-policy.com/)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 15

#### Source ID: 3

### [ Big Redirect Detected (Potential Sensitive Information Leak) ](https://www.zaproxy.org/docs/alerts/10044/)



##### Low (Medium)

### Description

The server has responded with a redirect that seems to provide a large response. This may indicate that although the server sent a redirect it also responded with body content (which may include sensitive details, PII, etc.).

* URL: http://host.docker.internal:3000
  * Node Name: `http://host.docker.internal:3000`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 6 [/panel].
Predicted response size: 306.
Response Body Length: 16,225.`
* URL: http://host.docker.internal:3000/
  * Node Name: `http://host.docker.internal:3000/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 6 [/panel].
Predicted response size: 306.
Response Body Length: 16,226.`


Instances: 2

### Solution

Ensure that no sensitive information is leaked via redirect responses. Redirect responses should have almost no content.

### Reference



#### CWE Id: [ 201 ](https://cwe.mitre.org/data/definitions/201.html)


#### WASC Id: 13

#### Source ID: 3

### [ Cross-Origin-Embedder-Policy Header Missing or Invalid ](https://www.zaproxy.org/docs/alerts/90004/)



##### Low (Medium)

### Description

Cross-Origin-Embedder-Policy header is a response header that prevents a document from loading any cross-origin resources that don't explicitly grant the document permission (using CORP or CORS).

* URL: http://host.docker.internal:3000
  * Node Name: `http://host.docker.internal:3000`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://host.docker.internal:3000/panel
  * Node Name: `http://host.docker.internal:3000/panel`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 2

### Solution

Ensure that the application/web server sets the Cross-Origin-Embedder-Policy header appropriately, and that it sets the Cross-Origin-Embedder-Policy header to 'require-corp' for documents.
If possible, ensure that the end user uses a standards-compliant and modern web browser that supports the Cross-Origin-Embedder-Policy header (https://caniuse.com/mdn-http_headers_cross-origin-embedder-policy).

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 14

#### Source ID: 3

### [ Cross-Origin-Opener-Policy Header Missing or Invalid ](https://www.zaproxy.org/docs/alerts/90004/)



##### Low (Medium)

### Description

Cross-Origin-Opener-Policy header is a response header that allows a site to control if others included documents share the same browsing context. Sharing the same browsing context with untrusted documents might lead to data leak.

* URL: http://host.docker.internal:3000
  * Node Name: `http://host.docker.internal:3000`
  * Method: `GET`
  * Parameter: `Cross-Origin-Opener-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://host.docker.internal:3000/panel
  * Node Name: `http://host.docker.internal:3000/panel`
  * Method: `GET`
  * Parameter: `Cross-Origin-Opener-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 2

### Solution

Ensure that the application/web server sets the Cross-Origin-Opener-Policy header appropriately, and that it sets the Cross-Origin-Opener-Policy header to 'same-origin' for documents.
'same-origin-allow-popups' is considered as less secured and should be avoided.
If possible, ensure that the end user uses a standards-compliant and modern web browser that supports the Cross-Origin-Opener-Policy header (https://caniuse.com/mdn-http_headers_cross-origin-opener-policy).

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 14

#### Source ID: 3

### [ Cross-Origin-Resource-Policy Header Missing or Invalid ](https://www.zaproxy.org/docs/alerts/90004/)



##### Low (Medium)

### Description

Cross-Origin-Resource-Policy header is an opt-in header designed to counter side-channels attacks like Spectre. Resource should be specifically set as shareable amongst different origins.

* URL: http://host.docker.internal:3000
  * Node Name: `http://host.docker.internal:3000`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://host.docker.internal:3000/_next/static/chunks/webpack.js%3Fv=1791902740099
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/webpack.js (v)`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://host.docker.internal:3000/_next/static/css/app/layout.css%3Fv=1791902740099
  * Node Name: `http://host.docker.internal:3000/_next/static/css/app/layout.css (v)`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://host.docker.internal:3000/panel
  * Node Name: `http://host.docker.internal:3000/panel`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://host.docker.internal:3000/robots.txt
  * Node Name: `http://host.docker.internal:3000/robots.txt`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``

Instances: Systemic


### Solution

Ensure that the application/web server sets the Cross-Origin-Resource-Policy header appropriately, and that it sets the Cross-Origin-Resource-Policy header to 'same-origin' for all web pages.
'same-site' is considered as less secured and should be avoided.
If resources must be shared, set the header to 'cross-origin'.
If possible, ensure that the end user uses a standards-compliant and modern web browser that supports the Cross-Origin-Resource-Policy header (https://caniuse.com/mdn-http_headers_cross-origin-resource-policy).

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 14

#### Source ID: 3

### [ Dangerous JS Functions ](https://www.zaproxy.org/docs/alerts/10110/)



##### Low (Low)

### Description

A dangerous JS function seems to be in use that would leave the site vulnerable.

* URL: http://host.docker.internal:3000/_next/static/chunks/app-pages-internals.js
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/app-pages-internals.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `eval(`
  * Other Info: ``
* URL: http://host.docker.internal:3000/_next/static/chunks/app/layout.js
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/app/layout.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `eval(`
  * Other Info: ``
* URL: http://host.docker.internal:3000/_next/static/chunks/app/panel/template.js
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/app/panel/template.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `eval(`
  * Other Info: ``
* URL: http://host.docker.internal:3000/_next/static/chunks/main-app.js%3Fv=1791902740099
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/main-app.js (v)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `eval(`
  * Other Info: ``


Instances: 4

### Solution

See the references for security advice on the use of these functions.

### Reference


* [ https://v17.angular.io/guide/security ](https://v17.angular.io/guide/security)


#### CWE Id: [ 749 ](https://cwe.mitre.org/data/definitions/749.html)


#### Source ID: 3

### [ Private IP Disclosure ](https://www.zaproxy.org/docs/alerts/2/)



##### Low (Medium)

### Description

A private IP (such as 10.x.x.x, 172.x.x.x, 192.168.x.x) or an Amazon EC2 private hostname (for example, ip-10-0-56-78) has been found in the HTTP response body. This information might be helpful for further attacks targeting internal systems.

* URL: http://host.docker.internal:3000/_next/static/chunks/app/layout.js
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/app/layout.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `10.9.88.88`
  * Other Info: `10.9.88.88
10.79.75.75
10.04.05.32
`


Instances: 1

### Solution

Remove the private IP address from the HTTP response body. For comments, use JSP/ASP/PHP comment instead of HTML/JavaScript comment which can be seen by client browsers.

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc1918 ](https://datatracker.ietf.org/doc/html/rfc1918)


#### CWE Id: [ 497 ](https://cwe.mitre.org/data/definitions/497.html)


#### WASC Id: 13

#### Source ID: 3

### [ Information Disclosure - Suspicious Comments ](https://www.zaproxy.org/docs/alerts/10027/)



##### Informational (Medium)

### Description

The response appears to contain suspicious comments which may help an attacker.

* URL: http://host.docker.internal:3000/_next/static/chunks/app-pages-internals.js
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/app-pages-internals.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `ad the output file, select a different devtool`
  * Other Info: `The following pattern was used: \bSELECT\b and was detected in likely comment: "/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable out", see evidence field for the suspicious comment/snippet.`
* URL: http://host.docker.internal:3000/_next/static/chunks/app-pages-internals.js
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/app-pages-internals.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `ponents%5C%5Crender-from-template-context.js`
  * Other Info: `The following pattern was used: \bFROM\b and was detected 2 times, the first in likely comment: "/*!*****************************************************************************************************************************", see evidence field for the suspicious comment/snippet.`
* URL: http://host.docker.internal:3000/_next/static/chunks/app/layout.js
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/app/layout.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `ad the output file, select a different devtool`
  * Other Info: `The following pattern was used: \bSELECT\b and was detected in likely comment: "/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable out", see evidence field for the suspicious comment/snippet.`
* URL: http://host.docker.internal:3000/_next/static/chunks/app/layout.js
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/app/layout.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `re deprecated. [See User Guidance](https://m`
  * Other Info: `The following pattern was used: \bUSER\b and was detected 43 times, the first in likely comment: "/** @deprecated Color icons are deprecated. [See User Guidance](https://microsoft.github.io/fluentui-system-icons/?path=/docs/ic", see evidence field for the suspicious comment/snippet.`
* URL: http://host.docker.internal:3000/_next/static/chunks/app/panel/template.js
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/app/panel/template.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `ad the output file, select a different devtool`
  * Other Info: `The following pattern was used: \bSELECT\b and was detected in likely comment: "/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable out", see evidence field for the suspicious comment/snippet.`
* URL: http://host.docker.internal:3000/_next/static/chunks/main-app.js%3Fv=1791902740099
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/main-app.js (v)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `ad the output file, select a different devtool`
  * Other Info: `The following pattern was used: \bSELECT\b and was detected in likely comment: "/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable out", see evidence field for the suspicious comment/snippet.`
* URL: http://host.docker.internal:3000/_next/static/chunks/main-app.js%3Fv=1791902740099
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/main-app.js (v)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `reducer/create-href-from-url.js ***!
  \****`
  * Other Info: `The following pattern was used: \bFROM\b and was detected 2 times, the first in likely comment: "/*!*****************************************************************************************************************************", see evidence field for the suspicious comment/snippet.`
* URL: http://host.docker.internal:3000/_next/static/chunks/webpack.js%3Fv=1791902740099
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/webpack.js (v)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `/** @type {TODO} */`
  * Other Info: `The following pattern was used: \bTODO\b and was detected in likely comment: "/** @type {TODO} */", see evidence field for the suspicious comment/snippet.`
* URL: http://host.docker.internal:3000/_next/static/chunks/webpack.js%3Fv=1791902740099
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/webpack.js (v)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `// inherit from previous dispose ca`
  * Other Info: `The following pattern was used: \bFROM\b and was detected 5 times, the first in likely comment: "// inherit from previous dispose call", see evidence field for the suspicious comment/snippet.`
* URL: http://host.docker.internal:3000/_next/static/chunks/webpack.js%3Fv=1791902740099
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/webpack.js (v)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `t useful stacktrace later`
  * Other Info: `The following pattern was used: \bLATER\b and was detected 3 times, the first in likely comment: "// create error before stack unwound to get useful stacktrace later", see evidence field for the suspicious comment/snippet.`


Instances: 10

### Solution

Remove all comments that return information that may help an attacker and fix any underlying problems they refer to.

### Reference



#### CWE Id: [ 615 ](https://cwe.mitre.org/data/definitions/615.html)


#### WASC Id: 13

#### Source ID: 3

### [ Modern Web Application ](https://www.zaproxy.org/docs/alerts/10109/)



##### Informational (Medium)

### Description

The application appears to be a modern web application. If you need to explore it automatically then the Client Spider may well be more effective than the standard one.

* URL: http://host.docker.internal:3000
  * Node Name: `http://host.docker.internal:3000`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/main-app.js" async=""></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://host.docker.internal:3000/
  * Node Name: `http://host.docker.internal:3000/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/main-app.js" async=""></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`


Instances: 2

### Solution

This is an informational alert and so no changes are required.

### Reference




#### Source ID: 3

### [ Non-Storable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are not storable by caching components such as proxy servers. If the response does not contain sensitive, personal or user-specific information, it may benefit from being stored and cached, to improve performance.

* URL: http://host.docker.internal:3000
  * Node Name: `http://host.docker.internal:3000`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://host.docker.internal:3000/
  * Node Name: `http://host.docker.internal:3000/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://host.docker.internal:3000/_next/static/chunks/webpack.js%3Fv=1791902740099
  * Node Name: `http://host.docker.internal:3000/_next/static/chunks/webpack.js (v)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://host.docker.internal:3000/_next/static/css/app/layout.css%3Fv=1791902740099
  * Node Name: `http://host.docker.internal:3000/_next/static/css/app/layout.css (v)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://host.docker.internal:3000/panel
  * Node Name: `http://host.docker.internal:3000/panel`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
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

### [ Storable but Non-Cacheable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are storable by caching components such as proxy servers, but will not be retrieved directly from the cache, without validating the request upstream, in response to similar requests from other users.

* URL: http://host.docker.internal:3000/robots.txt
  * Node Name: `http://host.docker.internal:3000/robots.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=0`
  * Other Info: ``


Instances: 1

### Solution



### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3


